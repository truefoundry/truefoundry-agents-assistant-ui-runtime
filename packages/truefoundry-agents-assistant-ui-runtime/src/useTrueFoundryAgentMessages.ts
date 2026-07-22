"use client";

import { generateId } from "@assistant-ui/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
    AgentSessionClient,
    McpAuthRequiredEvent,
    ToolApprovalRequiredEvent,
    ToolResponseRequiredEvent,
    Turn,
    TurnInputItem,
    TurnStateDone,
} from "truefoundry-gateway-sdk/agents";
import type { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";

import { ROOT_THREAD_ID } from "./constants.js";
import {
    buildEditedUserMessageContent,
    buildSnapshotBeforeTurn,
    computeGroupRootBaseline,
    extractTurnUserMessageContent,
    prependOlderSessionHistory,
    projectSessionMessages,
    resolveGatewayBranchPreviousTurnIdForTurn,
    rootModelMessageIdsSinceBaseline,
    userMessageContentToText,
    type UserMessageContent,
} from "./convertTurnMessages.js";
import { extractTurnUserText } from "./extractTurnUserText.js";
import { loadSessionSnapshot } from "./loadSessionSnapshot.js";
import { MCP_AUTH_RESUME_RUN_CUSTOM_KEY } from "./mcpAuth.js";
import type { TrueFoundryMessageCustomMetadata } from "./messageCustomMetadata.js";
import {
    collectRequiredActionInputs,
    findPausedAssistantMessage,
    messageHasPendingRequiredActions,
    type RequiredActionInput,
} from "./requiredActionInputs.js";
import { getSession, type GetSessionOptions } from "./sessions.js";
import {
    createEmptySessionSnapshot,
    replaceSessionSnapshot,
    type SessionSnapshot,
    type SessionTurnRecord,
} from "./sessionSnapshot.js";
import { resumeTurnStream, streamTurnContent } from "./streamTurn.js";
import {
    TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY,
    type RespondToToolApprovalOptions,
} from "./toolApproval.js";
import {
    applyUserToolResponsesToFold,
    TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY,
    type RespondToToolResponseOptions,
} from "./toolResponse.js";
import type { TurnStreamUpdate } from "./turnStreamUpdate.js";

export type UseTrueFoundryAgentMessagesOptions = {
    client: AgentSessionClient;
    sessionId: string | undefined;
    /** When true the thread is the currently selected (main) thread. */
    isMain?: boolean | undefined;
    listEventsConcurrency?: number | undefined;
    onError?: ((error: unknown) => void) | undefined;
    initializeSession?: () => Promise<{
        remoteId: string;
        externalId: string | undefined;
    }>;
    /** Maps a thread `remoteId` to the gateway session id used for turns. */
    resolveConversationSessionId?: (remoteId: string) => Promise<string>;
    /** When set, turns bind via PrivateAgentSessionClient.getDraftSession. */
    privateClient?: PrivateAgentSessionClient;
    /**
     * Optional per-turn headers for createTurn. Invoked once per `sendTurn` after
     * the session is resolved; return value is forwarded to `turn.execute`.
     */
    getTurnHeaders?: () => Promise<Record<string, string> | undefined>;
};

export type SendTurnOptions =
    | {
          userMessage: UserMessageContent;
          previousTurnId?: string | null;
          /**
           * When branching (edit/reset), the already-rewound history to send from.
           * Applied atomically with `pendingUser` so a stale React snapshot cannot
           * keep pre-branch turns while the new user message is appended.
           */
          branchFromSnapshot?: SessionSnapshot;
      }
    | { inputs: RequiredActionInput[] }
    | { resumeMcpAuth: true };

function buildCompletedTurnState(
    completedAt: string,
    requiredActions: TurnStateDone["requiredActions"] = [],
): TurnStateDone {
    return {
        status: "done",
        requiredActions,
        completedAt,
    };
}

/**
 * Reconstructs the pending required actions a paused in-flight update carried,
 * so the pause survives `commitActiveStream`'s synthetic "done" state.
 *
 * `commitActiveStream` fabricates a `TurnStateDone` for the just-finished
 * stream, and the projection derives an assistant message's `requires-action`
 * status from `turn.state.requiredActions` (see `findApprovalRequiredInTurn` /
 * `findResponseRequiredInTurn` / `findMcpAuthRequired`). If we returned an empty
 * list here, the committed turn would look "complete", the projected message
 * would lose its `requires-action` status, and `findPausedAssistantMessage`
 * (used by `trySendCollectedRequiredActions`) would never see it — so answering
 * a tool approval or an `ask_user_question` would never send the resume turn.
 *
 * The paused update already carries the pause state: `status` is
 * `requires-action` and `metadata.custom` holds the pending thread id(s) (and,
 * for MCP, the server list). Only the thread id is read downstream, so an empty
 * `toolCalls` list is sufficient here — the resume inputs are collected from the
 * message content, not from these reconstructed actions.
 */
export function requiredActionsFromActiveUpdate(
    update: TurnStreamUpdate,
): TurnStateDone["requiredActions"] {
    const custom = update.metadata?.custom as TrueFoundryMessageCustomMetadata | undefined;
    const requiredActions: TurnStateDone["requiredActions"] = [];
    const createdAt = new Date().toISOString();

    if (custom?.pendingMcpAuth === true && Array.isArray(custom.mcpServers)) {
        const mcpAuthRequired: McpAuthRequiredEvent = {
            type: "mcp.auth_required",
            id: generateId(),
            createdAt,
            mcpServers: custom.mcpServers,
        };
        requiredActions.push(mcpAuthRequired);
    }

    if (update.status?.type === "requires-action") {
        const approvalThreadId = custom?.[TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY];
        if (typeof approvalThreadId === "string") {
            const approvalRequired: ToolApprovalRequiredEvent = {
                type: "tool.approval_required",
                id: generateId(),
                createdAt,
                threadId: approvalThreadId,
                toolCalls: [],
            };
            requiredActions.push(approvalRequired);
        }

        const responseThreadId = custom?.[TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY];
        if (typeof responseThreadId === "string") {
            const responseRequired: ToolResponseRequiredEvent = {
                type: "tool.response_required",
                id: generateId(),
                createdAt,
                threadId: responseThreadId,
                toolCalls: [],
            };
            requiredActions.push(responseRequired);
        }
    }

    return requiredActions;
}

function buildUserTurnInput(content: UserMessageContent): TurnInputItem {
    return { type: "user.message", content };
}

function appendTurnInputs(
    base: TurnInputItem[],
    continuationInputs?: RequiredActionInput[],
): TurnInputItem[] {
    if (continuationInputs == null || continuationInputs.length === 0) {
        return base;
    }
    return [...base, ...continuationInputs];
}

function commitActiveStream(
    snapshot: SessionSnapshot,
    continuationInputs?: RequiredActionInput[],
): SessionSnapshot {
    const active = snapshot.activeStream;
    if (active == null || active.streamComplete !== true) {
        return snapshot;
    }

    const activeSandboxId = (
        active.update.metadata?.custom as { sandboxId?: string } | undefined
    )?.sandboxId;

    const completedState = buildCompletedTurnState(
        new Date().toISOString(),
        requiredActionsFromActiveUpdate(active.update),
    );
    const baseline =
        snapshot.groupRootBaseline ?? computeGroupRootBaseline(snapshot.turns);
    const rootModelMessageIds = rootModelMessageIdsSinceBaseline(
        snapshot.fold,
        baseline,
    );

    const lastTurn = snapshot.turns.at(-1);
    if (lastTurn?.id === active.turnId) {
        return replaceSessionSnapshot(snapshot, {
            turns: snapshot.turns.map((turn) =>
                turn.id === active.turnId
                    ? {
                          ...turn,
                          state: completedState,
                          input: appendTurnInputs(turn.input ?? [], continuationInputs),
                          ...(rootModelMessageIds != null
                              ? { rootModelMessageIds }
                              : {}),
                          ...(activeSandboxId != null ? { sandboxId: activeSandboxId } : {}),
                      }
                    : turn,
            ),
            pendingUser: undefined,
            activeStream: undefined,
        });
    }

    const record: SessionTurnRecord = {
        id: active.turnId,
        createdAt:
            snapshot.pendingUser?.createdAt.toISOString() ?? new Date().toISOString(),
        state: completedState,
        input: appendTurnInputs(
            snapshot.pendingUser
                ? [buildUserTurnInput(snapshot.pendingUser.content)]
                : [],
            continuationInputs,
        ),
        ...(snapshot.pendingUser != null
            ? { userText: userMessageContentToText(snapshot.pendingUser.content) }
            : {}),
        ...(rootModelMessageIds != null ? { rootModelMessageIds } : {}),
        ...(activeSandboxId != null ? { sandboxId: activeSandboxId } : {}),
    };

    return replaceSessionSnapshot(snapshot, {
        turns: [...snapshot.turns, record],
        pendingUser: undefined,
        activeStream: undefined,
    });
}

async function resolveActiveSessionId(
    remoteId: string,
    resolveConversationSessionId?: (remoteId: string) => Promise<string>,
): Promise<string> {
    if (resolveConversationSessionId != null) {
        return resolveConversationSessionId(remoteId);
    }
    return remoteId;
}

function findTurnIndex(snapshot: SessionSnapshot, turnId: string): number {
    const committedIndex = snapshot.turns.findIndex((turn) => turn.id === turnId);
    if (committedIndex !== -1) {
        return committedIndex;
    }
    if (snapshot.pendingUser?.turnId === turnId) {
        return snapshot.turns.length;
    }
    throw new Error(`Turn ${turnId} not found in session snapshot`);
}

function resolveTurnInput(
    snapshot: SessionSnapshot,
    turnId: string,
): TurnInputItem[] | undefined {
    const turnRecord = snapshot.turns.find((turn) => turn.id === turnId);
    if (turnRecord?.input != null) {
        return turnRecord.input;
    }
    if (snapshot.pendingUser?.turnId === turnId) {
        return [{ type: "user.message", content: snapshot.pendingUser.content }];
    }
    return undefined;
}

export function useTrueFoundryAgentMessages({
    client,
    sessionId,
    isMain,
    listEventsConcurrency,
    onError,
    initializeSession,
    resolveConversationSessionId,
    privateClient,
    getTurnHeaders,
}: UseTrueFoundryAgentMessagesOptions) {
    const sessionOptions = useMemo<GetSessionOptions | undefined>(
        () =>
            privateClient != null ? { privateClient } : undefined,
        [privateClient],
    );

    const [snapshot, setSnapshot] = useState<SessionSnapshot>(createEmptySessionSnapshot);
    const [isRunning, setIsRunning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false);
    const [loadRetryTrigger, setLoadRetryTrigger] = useState(0);

    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;
    const loadOlderInflightRef = useRef<Promise<void> | null>(null);

    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const resolveConversationSessionIdRef = useRef(resolveConversationSessionId);
    resolveConversationSessionIdRef.current = resolveConversationSessionId;
    const initializeSessionRef = useRef(initializeSession);
    initializeSessionRef.current = initializeSession;
    const getTurnHeadersRef = useRef(getTurnHeaders);
    getTurnHeadersRef.current = getTurnHeaders;

    const createdAtByMessageIdRef = useRef(new Map<string, Date>());
    const abortControllerRef = useRef<AbortController | null>(null);
    const activeRunRef = useRef<Promise<void> | null>(null);
    const runningTurnRef = useRef<Turn | undefined>(undefined);
    const loadGenerationRef = useRef(0);
    const streamGenerationRef = useRef(0);
    const lazilyCreatedSessionIdRef = useRef<string | undefined>(undefined);

    const projectOptions = useMemo(
        () => ({
            getCreatedAt: (messageId: string, fallback: Date) => {
                const cache = createdAtByMessageIdRef.current;
                const existing = cache.get(messageId);
                if (existing != null) {
                    return existing;
                }
                cache.set(messageId, fallback);
                return fallback;
            },
        }),
        [],
    );

    const messages = useMemo(
        () => projectSessionMessages(snapshot, projectOptions),
        [snapshot, projectOptions],
    );

    const runStream = useCallback(
        (
            createStream: (signal: AbortSignal) => AsyncGenerator<TurnStreamUpdate>,
            turnId: string,
            isContinuation: boolean,
        ): Promise<void> => {
            const streamGeneration = ++streamGenerationRef.current;
            abortControllerRef.current?.abort();
            const abortController = new AbortController();
            abortControllerRef.current = abortController;
            setIsRunning(true);

            const run = (async () => {
                // Sub-agent turns can emit 100+ stream events per frame. Coalesce to one
                // setSnapshot per animation frame so assistant-ui does not remount the whole
                // message tree (UI hang). The buffer belongs to this stream only.
                let pendingStreamUpdate: {
                    update: TurnStreamUpdate;
                    turnId: string;
                    isContinuation: boolean;
                } | null = null;
                let streamUpdateRaf: number | null = null;

                const flushPendingStreamUpdate = () => {
                    streamUpdateRaf = null;
                    const pending = pendingStreamUpdate;
                    pendingStreamUpdate = null;
                    if (
                        pending == null ||
                        streamGeneration !== streamGenerationRef.current
                    ) {
                        return;
                    }
                    const { update, turnId: pendingTurnId, isContinuation: pendingIsContinuation } =
                        pending;
                    setSnapshot((prev) =>
                        replaceSessionSnapshot(prev, {
                            activeStream: {
                                turnId: pendingTurnId,
                                update,
                                isContinuation: pendingIsContinuation,
                            },
                        }),
                    );
                };

                const applyStreamUpdate = (update: TurnStreamUpdate) => {
                    pendingStreamUpdate = { update, turnId, isContinuation };
                    if (streamUpdateRaf == null) {
                        streamUpdateRaf = requestAnimationFrame(flushPendingStreamUpdate);
                    }
                };

                try {
                    for await (const update of createStream(abortController.signal)) {
                        if (abortController.signal.aborted) {
                            return;
                        }
                        applyStreamUpdate(update);
                    }
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") {
                        return;
                    }
                    onErrorRef.current?.(error);
                    throw error;
                } finally {
                    if (streamUpdateRaf != null) {
                        cancelAnimationFrame(streamUpdateRaf);
                        streamUpdateRaf = null;
                    }
                    if (streamGeneration !== streamGenerationRef.current) {
                        return;
                    }
                    flushPendingStreamUpdate();
                    if (abortControllerRef.current === abortController) {
                        abortControllerRef.current = null;
                    }
                    setIsRunning(false);
                    setSnapshot((prev) => {
                        if (prev.activeStream == null) {
                            return prev;
                        }
                        const marked = replaceSessionSnapshot(prev, {
                            activeStream: {
                                ...prev.activeStream,
                                streamComplete: true,
                            },
                            requiredActions: {
                                approvals: new Map(),
                                toolResponses: new Map(),
                            },
                        });
                        return commitActiveStream(marked);
                    });
                }
            })();

            activeRunRef.current = run;
            void run
                .catch(() => undefined)
                .finally(() => {
                    if (activeRunRef.current === run) {
                        activeRunRef.current = null;
                    }
                });
            return run;
        },
        [onError],
    );

    const load = useCallback(async () => {
        if (sessionId == null) {
            createdAtByMessageIdRef.current = new Map();
            setSnapshot(createEmptySessionSnapshot());
            return;
        }

        // Thread components are never unmounted on navigation — isMain going
        // false→true is the only reliable signal that the user has clicked on
        // this thread.  Skip the load when this thread is not the active one
        // so that isMain being a dep triggers a fresh load on every selection.
        if (isMain === false) return;

        // When we are loading a *different* session the user has navigated away
        // from the lazily-created one — clear the guard so navigating back to it
        // later triggers a proper reload instead of silently skipping.
        if (lazilyCreatedSessionIdRef.current != null && sessionId !== lazilyCreatedSessionIdRef.current) {
            lazilyCreatedSessionIdRef.current = undefined;
        }

        if (sessionId === lazilyCreatedSessionIdRef.current) {
            return;
        }

        const generation = ++loadGenerationRef.current;
        ++streamGenerationRef.current;
        abortControllerRef.current?.abort();
        loadOlderInflightRef.current = null;
        createdAtByMessageIdRef.current = new Map();
        setSnapshot(createEmptySessionSnapshot());
        setIsLoading(true);
        setIsLoadingOlderHistory(false);

        try {
            const conversationSessionId = await resolveActiveSessionId(
                sessionId,
                resolveConversationSessionIdRef.current,
            );
            const loadedSnapshot = await loadSessionSnapshot(
                client,
                conversationSessionId,
                sessionOptions,
                (snap) => {
                    if (generation === loadGenerationRef.current) {
                        setSnapshot(snap);
                    }
                },
            );
            if (generation !== loadGenerationRef.current) {
                return;
            }

            createdAtByMessageIdRef.current = new Map();
            setSnapshot(loadedSnapshot);
            runningTurnRef.current = loadedSnapshot.runningTurn;

            // History (and any seeded pendingUser for the in-flight turn) is
            // ready — clear loading before resuming. Awaiting the subscribe
            // stream here previously kept isLoading true for the entire
            // backend run, so reconnect UIs stayed on shimmers even though
            // subscribe was already live.
            setIsLoading(false);

            if (loadedSnapshot.runningTurn != null) {
                const turn = loadedSnapshot.runningTurn;
                const isContinuation = !extractTurnUserText(turn.input);
                // TODO: pass afterSequenceNumber once stream ingestion tracks sequence numbers.
                // Use loadedSnapshot directly — snapshotRef.current still points at
                // the empty snapshot cleared above until the setSnapshot(loadedSnapshot)
                // call re-renders.
                void runStream(
                    (signal) =>
                        resumeTurnStream(
                            turn,
                            loadedSnapshot.fold,
                            signal,
                            undefined,
                            loadedSnapshot.groupRootBaseline,
                        ),
                    turn.id,
                    isContinuation,
                ).catch(() => undefined);
            }
        } catch (error) {
            if (generation === loadGenerationRef.current) {
                onErrorRef.current?.(error);
            }
            throw error;
        } finally {
            if (generation === loadGenerationRef.current) {
                setIsLoading(false);
            }
        }
    }, [client, runStream, sessionId, sessionOptions, loadRetryTrigger, isMain]);

    useEffect(() => {
        void load().catch(() => undefined);
    }, [load]);

    const sendTurn = useCallback(
        async (options: SendTurnOptions) => {
            let activeSessionId = sessionId;
            if (activeSessionId == null) {
                if (initializeSessionRef.current == null) {
                    throw new Error("Cannot send a turn without an active session.");
                }
                const { remoteId } = await initializeSessionRef.current();
                activeSessionId = remoteId;
                lazilyCreatedSessionIdRef.current = remoteId;
            }

            const conversationSessionId = await resolveActiveSessionId(
                activeSessionId,
                resolveConversationSessionIdRef.current,
            );
            const session = await getSession(client, conversationSessionId, sessionOptions);
            const turnHeaders = await getTurnHeadersRef.current?.();
            const streamHeaders =
                turnHeaders != null ? { headers: turnHeaders } : {};
            const isContinuation =
                "inputs" in options ||
                ("resumeMcpAuth" in options && options.resumeMcpAuth === true);
            const continuationTurnId = snapshotRef.current.activeStream?.turnId;
            const turnId =
                isContinuation && continuationTurnId != null
                    ? continuationTurnId
                    : generateId();
            // First turns must send previousTurnId: null.
            const isFirstTurnInSession =
                "userMessage" in options &&
                options.previousTurnId === undefined &&
                snapshotRef.current.turns.length === 0 &&
                snapshotRef.current.pendingUser == null &&
                snapshotRef.current.activeStream == null;

            if ("inputs" in options) {
                applyUserToolResponsesToFold(
                    snapshotRef.current.fold,
                    options.inputs,
                );
            }

            const branchBase =
                "userMessage" in options ? options.branchFromSnapshot : undefined;

            let groupRootBaseline: readonly string[] | undefined;

            if (branchBase != null && "userMessage" in options) {
                // Atomic apply: never merge pendingUser onto a stale React `prev`
                // that still holds pre-branch turns (edit would show old + new).
                const rootBucket = branchBase.fold.threads.get(ROOT_THREAD_ID);
                groupRootBaseline = [...(rootBucket?.modelMessageIds ?? [])];
                const nextSnapshot = replaceSessionSnapshot(branchBase, {
                    pendingUser: {
                        turnId,
                        content: options.userMessage,
                        createdAt: new Date(),
                    },
                    activeStream: undefined,
                    groupRootBaseline,
                });
                snapshotRef.current = nextSnapshot;
                setSnapshot(nextSnapshot);
            } else {
                setSnapshot((prev) =>
                    commitActiveStream(
                        prev,
                        "inputs" in options ? options.inputs : undefined,
                    ),
                );

                if ("userMessage" in options) {
                    const rootBucket =
                        snapshotRef.current.fold.threads.get(ROOT_THREAD_ID);
                    groupRootBaseline = [...(rootBucket?.modelMessageIds ?? [])];
                    setSnapshot((prev) => {
                        const next = replaceSessionSnapshot(prev, {
                            pendingUser: {
                                turnId,
                                content: options.userMessage,
                                createdAt: new Date(),
                            },
                            activeStream: undefined,
                            groupRootBaseline,
                        });
                        snapshotRef.current = next;
                        return next;
                    });
                } else {
                    groupRootBaseline =
                        snapshotRef.current.groupRootBaseline ??
                        computeGroupRootBaseline(snapshotRef.current.turns);
                }
            }

            await runStream(
                (signal) => {
                    if ("inputs" in options) {
                        return streamTurnContent(
                            session,
                            snapshotRef.current.fold,
                            { inputs: options.inputs, ...streamHeaders },
                            signal,
                            groupRootBaseline,
                        );
                    }
                    if ("resumeMcpAuth" in options) {
                        return streamTurnContent(
                            session,
                            snapshotRef.current.fold,
                            { resumeMcpAuth: true, ...streamHeaders },
                            signal,
                            groupRootBaseline,
                        );
                    }
                    return streamTurnContent(
                        session,
                        snapshotRef.current.fold,
                        {
                            userMessage: options.userMessage,
                            ...(options.previousTurnId !== undefined
                                ? { previousTurnId: options.previousTurnId }
                                : isFirstTurnInSession
                                  ? { previousTurnId: null }
                                  : {}),
                            ...streamHeaders,
                        },
                        signal,
                        groupRootBaseline,
                    );
                },
                turnId,
                isContinuation,
            );
        },
        [client, runStream, sessionId, sessionOptions],
    );

    const cancel = useCallback(async () => {
        if (sessionId == null) {
            abortControllerRef.current?.abort();
            return;
        }
        const conversationSessionId = await resolveActiveSessionId(
            sessionId,
            resolveConversationSessionIdRef.current,
        );
        const session = await getSession(client, conversationSessionId, sessionOptions);
        // Request cancellation but keep consuming the stream. After cancel(),
        // the backend gracefully closes the SSE stream: it emits a terminal
        // turn.done event and then ends the stream, which lets the active run
        // drain to completion on its own instead of being torn down mid-flight.
        await session.cancel().catch(() => undefined);
        // Wait for the in-flight stream to finish draining. No explicit
        // reconcile is needed here — the cancelled turn is terminal and local
        // state reconciles against the event log on the next session load.
        await activeRunRef.current?.catch(() => undefined);
    }, [client, sessionId, sessionOptions]);

    const isRunningRef = useRef(isRunning);
    isRunningRef.current = isRunning;

    const trySendCollectedRequiredActions = useCallback(
        (nextSnapshot: SessionSnapshot) => {
            if (isRunningRef.current) {
                return;
            }
            const projected = projectSessionMessages(nextSnapshot, projectOptions);
            const paused = findPausedAssistantMessage(projected);
            if (paused == null || messageHasPendingRequiredActions(paused)) {
                return;
            }
            const inputs = collectRequiredActionInputs(paused);
            if (inputs.length > 0) {
                void sendTurn({ inputs }).catch((error) => onErrorRef.current?.(error));
            }
        },
        [projectOptions, sendTurn],
    );

    const respondToToolApproval = useCallback(
        (response: RespondToToolApprovalOptions) => {
            const prev = snapshotRef.current;
            const approvals = new Map(prev.requiredActions.approvals);
            approvals.set(response.approvalId, {
                approved: response.approved,
                ...(response.reason != null ? { reason: response.reason } : {}),
            });
            const nextSnapshot = replaceSessionSnapshot(prev, {
                requiredActions: {
                    ...prev.requiredActions,
                    approvals,
                },
            });
            setSnapshot(nextSnapshot);
            trySendCollectedRequiredActions(nextSnapshot);
        },
        [trySendCollectedRequiredActions],
    );

    const respondToToolResponse = useCallback(
        (response: RespondToToolResponseOptions) => {
            const prev = snapshotRef.current;
            const toolResponses = new Map(prev.requiredActions.toolResponses);
            toolResponses.set(response.toolCallId, { content: response.content });
            const nextSnapshot = replaceSessionSnapshot(prev, {
                requiredActions: {
                    ...prev.requiredActions,
                    toolResponses,
                },
            });
            setSnapshot(nextSnapshot);
            trySendCollectedRequiredActions(nextSnapshot);
        },
        [trySendCollectedRequiredActions],
    );

    const resumeRun = useCallback(async () => {
        const turn = runningTurnRef.current;
        if (turn == null) {
            return;
        }
        // TODO: pass afterSequenceNumber once stream ingestion tracks sequence numbers.
        await runStream(
            (signal) =>
                resumeTurnStream(
                    turn,
                    snapshotRef.current.fold,
                    signal,
                    undefined,
                    snapshotRef.current.groupRootBaseline,
                ),
            turn.id,
            true,
        );
    }, [runStream]);

    const branchFromTurn = useCallback(
        async (turnId: string, userMessage: UserMessageContent) => {
            let activeSessionId = sessionId;
            if (activeSessionId == null) {
                throw new Error("Cannot branch from a turn without an active session.");
            }

            const committed = commitActiveStream(snapshotRef.current);
            setSnapshot(committed);

            await cancel();

            const conversationSessionId = await resolveActiveSessionId(
                activeSessionId,
                resolveConversationSessionIdRef.current,
            );
            const session = await getSession(client, conversationSessionId, sessionOptions);
            const previousTurnId = await resolveGatewayBranchPreviousTurnIdForTurn(
                session,
                turnId,
            );
            const rewound = await buildSnapshotBeforeTurn(
                session,
                turnId,
                listEventsConcurrency,
            );
            createdAtByMessageIdRef.current = new Map();
            // Keep the ref aligned before awaiting sendTurn so any intermediate
            // reads (and the atomic pendingUser apply) see the rewound history.
            snapshotRef.current = rewound;
            setSnapshot(rewound);

            await sendTurn({
                userMessage,
                previousTurnId,
                branchFromSnapshot: rewound,
            });
        },
        [
            cancel,
            client,
            listEventsConcurrency,
            sendTurn,
            sessionId,
            sessionOptions,
        ],
    );

    const resetFromTurn = useCallback(
        async (turnId: string) => {
            const committed = commitActiveStream(snapshotRef.current);
            const originalInput = resolveTurnInput(committed, turnId);
            if (originalInput == null) {
                throw new Error(`Turn ${turnId} not found in session snapshot`);
            }
            const userMessage = extractTurnUserMessageContent(originalInput);
            await branchFromTurn(turnId, userMessage);
        },
        [branchFromTurn],
    );

    const editFromTurn = useCallback(
        async (turnId: string, editedText: string) => {
            const committed = commitActiveStream(snapshotRef.current);
            const originalInput = resolveTurnInput(committed, turnId);
            if (originalInput == null) {
                throw new Error(`Turn ${turnId} not found in session snapshot`);
            }
            const userMessage = buildEditedUserMessageContent(
                editedText,
                originalInput,
            );
            await branchFromTurn(turnId, userMessage);
        },
        [branchFromTurn],
    );

    const retryLoad = useCallback(() => {
        setLoadRetryTrigger((n) => n + 1);
    }, []);

    const hasOlderHistory = snapshot.historyPagination?.hasOlder === true;

    const loadOlderHistory = useCallback(async () => {
        if (sessionId == null || isMain === false) {
            return;
        }
        if (loadOlderInflightRef.current != null) {
            return loadOlderInflightRef.current;
        }

        const current = snapshotRef.current;
        if (current.historyPagination?.hasOlder !== true) {
            return;
        }
        if (current.historyPagination.olderPageToken == null) {
            return;
        }

        const generation = loadGenerationRef.current;
        setIsLoadingOlderHistory(true);

        const run = (async () => {
            try {
                const conversationSessionId = await resolveActiveSessionId(
                    sessionId,
                    resolveConversationSessionIdRef.current,
                );
                const session = await getSession(
                    client,
                    conversationSessionId,
                    sessionOptions,
                );
                const next = await prependOlderSessionHistory(
                    session,
                    snapshotRef.current,
                );
                if (generation !== loadGenerationRef.current) {
                    return;
                }
                setSnapshot(next);
            } catch (error) {
                if (generation === loadGenerationRef.current) {
                    onErrorRef.current?.(error);
                }
                throw error;
            } finally {
                if (generation === loadGenerationRef.current) {
                    setIsLoadingOlderHistory(false);
                }
                loadOlderInflightRef.current = null;
            }
        })();

        loadOlderInflightRef.current = run;
        return run;
    }, [client, isMain, sessionId, sessionOptions]);

    return {
        messages,
        isRunning,
        isLoading,
        isLoadingOlderHistory,
        hasOlderHistory,
        loadOlderHistory,
        retryLoad,
        sendTurn,
        cancel,
        respondToToolApproval,
        respondToToolResponse,
        resumeRun,
        branchFromTurn,
        resetFromTurn,
        editFromTurn,
    };
}

export { findPausedAssistantMessage, MCP_AUTH_RESUME_RUN_CUSTOM_KEY };

