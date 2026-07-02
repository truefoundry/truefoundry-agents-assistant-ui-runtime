"use client";

import { generateId } from "@assistant-ui/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
    AgentSessionClient,
    Turn,
    TurnInputItem,
    TurnStateDone,
} from "truefoundry-gateway-sdk/agents";
import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";

import { ROOT_THREAD_ID } from "./constants.js";
import {
    buildEditedUserMessageContent,
    buildSnapshotBeforeTurnIndex,
    computeGroupRootBaseline,
    extractTurnUserMessageContent,
    projectSessionMessages,
    resolveGatewayBranchPreviousTurnId,
    rootModelMessageIdsSinceBaseline,
    userMessageContentToText,
    type UserMessageContent,
} from "./convertTurnMessages.js";
import { extractTurnUserText } from "./extractTurnUserText.js";
import { loadSessionSnapshot } from "./loadSessionSnapshot.js";
import { MCP_AUTH_RESUME_RUN_CUSTOM_KEY } from "./mcpAuth.js";
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
import type { RespondToToolApprovalOptions } from "./toolApproval.js";
import {
    applyUserToolResponsesToFold,
    type RespondToToolResponseOptions,
} from "./toolResponse.js";
import type { TurnStreamUpdate } from "./turnStreamUpdate.js";

export type UseTrueFoundryAgentMessagesOptions = {
    client: AgentSessionClient;
    sessionId: string | undefined;
    listEventsConcurrency?: number | undefined;
    onError?: ((error: unknown) => void) | undefined;
    initializeSession?: () => Promise<{
        remoteId: string;
        externalId: string | undefined;
    }>;
    /** Maps a thread `remoteId` to the gateway session id used for turns. */
    resolveConversationSessionId?: (remoteId: string) => Promise<string>;
    /** When set, turns bind to `/agents/sessions/{draftSessionId}/turns` after draft validation. */
    draftGateway?: TrueFoundryGateway;
};

export type SendTurnOptions =
    | { userMessage: UserMessageContent; previousTurnId?: string | null }
    | { inputs: RequiredActionInput[] }
    | { resumeMcpAuth: true };

function buildCompletedTurnState(completedAt: string): TurnStateDone {
    return {
        status: "done",
        requiredActions: [],
        completedAt,
    };
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

    const completedState = buildCompletedTurnState(new Date().toISOString());
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
    listEventsConcurrency,
    onError,
    initializeSession,
    resolveConversationSessionId,
    draftGateway,
}: UseTrueFoundryAgentMessagesOptions) {
    const sessionOptions = useMemo<GetSessionOptions | undefined>(
        () =>
            draftGateway != null ? { draftGateway } : undefined,
        [draftGateway],
    );

    const [snapshot, setSnapshot] = useState<SessionSnapshot>(createEmptySessionSnapshot);
    const [isRunning, setIsRunning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    const createdAtByMessageIdRef = useRef(new Map<string, Date>());
    const abortControllerRef = useRef<AbortController | null>(null);
    const activeRunRef = useRef<Promise<void> | null>(null);
    const runningTurnRef = useRef<Turn | undefined>(undefined);
    const loadGenerationRef = useRef(0);
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

    const applyStreamUpdate = useCallback(
        (update: TurnStreamUpdate, turnId: string, isContinuation: boolean) => {
            setSnapshot((prev) =>
                replaceSessionSnapshot(prev, {
                    activeStream: {
                        turnId,
                        update,
                        isContinuation,
                    },
                }),
            );
        },
        [],
    );

    const runStream = useCallback(
        (
            createStream: (signal: AbortSignal) => AsyncGenerator<TurnStreamUpdate>,
            turnId: string,
            isContinuation: boolean,
        ): Promise<void> => {
            abortControllerRef.current?.abort();
            const abortController = new AbortController();
            abortControllerRef.current = abortController;
            setIsRunning(true);

            const run = (async () => {
                try {
                    for await (const update of createStream(abortController.signal)) {
                        if (abortController.signal.aborted) {
                            return;
                        }
                        applyStreamUpdate(update, turnId, isContinuation);
                    }
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") {
                        return;
                    }
                    onError?.(error);
                    throw error;
                } finally {
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
        [applyStreamUpdate, onError],
    );

    const load = useCallback(async () => {
        if (sessionId == null) {
            createdAtByMessageIdRef.current = new Map();
            setSnapshot(createEmptySessionSnapshot());
            return;
        }
        if (sessionId === lazilyCreatedSessionIdRef.current) {
            return;
        }

        const generation = ++loadGenerationRef.current;
        abortControllerRef.current?.abort();
        setIsLoading(true);

        try {
            const conversationSessionId = await resolveActiveSessionId(
                sessionId,
                resolveConversationSessionId,
            );
            const loadedSnapshot = await loadSessionSnapshot(
                client,
                conversationSessionId,
                listEventsConcurrency,
                sessionOptions,
            );
            if (generation !== loadGenerationRef.current) {
                return;
            }

            createdAtByMessageIdRef.current = new Map();
            setSnapshot(loadedSnapshot);
            runningTurnRef.current = loadedSnapshot.runningTurn;

            if (loadedSnapshot.runningTurn != null) {
                const turn = loadedSnapshot.runningTurn;
                const isContinuation = !extractTurnUserText(turn.input);
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
                    isContinuation,
                );
            }
        } catch (error) {
            onError?.(error);
            throw error;
        } finally {
            if (generation === loadGenerationRef.current) {
                setIsLoading(false);
            }
        }
    }, [client, listEventsConcurrency, onError, resolveConversationSessionId, runStream, sessionId, sessionOptions]);

    useEffect(() => {
        void load().catch(() => undefined);
    }, [load]);

    const sendTurn = useCallback(
        async (options: SendTurnOptions) => {
            let activeSessionId = sessionId;
            if (activeSessionId == null) {
                if (initializeSession == null) {
                    throw new Error("Cannot send a turn without an active session.");
                }
                const { remoteId } = await initializeSession();
                activeSessionId = remoteId;
                lazilyCreatedSessionIdRef.current = remoteId;
            }

            const conversationSessionId = await resolveActiveSessionId(
                activeSessionId,
                resolveConversationSessionId,
            );
            const session = await getSession(client, conversationSessionId, sessionOptions);
            const isContinuation =
                "inputs" in options ||
                ("resumeMcpAuth" in options && options.resumeMcpAuth === true);
            const continuationTurnId = snapshotRef.current.activeStream?.turnId;
            const turnId =
                isContinuation && continuationTurnId != null
                    ? continuationTurnId
                    : generateId();

            if ("inputs" in options) {
                applyUserToolResponsesToFold(
                    snapshotRef.current.fold,
                    options.inputs,
                );
            }

            setSnapshot((prev) =>
                commitActiveStream(
                    prev,
                    "inputs" in options ? options.inputs : undefined,
                ),
            );

            let groupRootBaseline: readonly string[] | undefined;

            if ("userMessage" in options) {
                const rootBucket =
                    snapshotRef.current.fold.threads.get(ROOT_THREAD_ID);
                groupRootBaseline = [...(rootBucket?.modelMessageIds ?? [])];
                setSnapshot((prev) =>
                    replaceSessionSnapshot(prev, {
                        pendingUser: {
                            turnId,
                            content: options.userMessage,
                            createdAt: new Date(),
                        },
                        activeStream: undefined,
                        groupRootBaseline,
                    }),
                );
            } else {
                groupRootBaseline =
                    snapshotRef.current.groupRootBaseline ??
                    computeGroupRootBaseline(snapshotRef.current.turns);
            }

            await runStream(
                (signal) => {
                    if ("inputs" in options) {
                        return streamTurnContent(
                            session,
                            snapshotRef.current.fold,
                            { inputs: options.inputs },
                            signal,
                            groupRootBaseline,
                        );
                    }
                    if ("resumeMcpAuth" in options) {
                        return streamTurnContent(
                            session,
                            snapshotRef.current.fold,
                            { resumeMcpAuth: true },
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
                                : {}),
                        },
                        signal,
                        groupRootBaseline,
                    );
                },
                turnId,
                isContinuation,
            );
        },
        [client, initializeSession, resolveConversationSessionId, runStream, sessionId, sessionOptions],
    );

    const cancel = useCallback(async () => {
        if (sessionId == null) {
            abortControllerRef.current?.abort();
            return;
        }
        const conversationSessionId = await resolveActiveSessionId(
            sessionId,
            resolveConversationSessionId,
        );
        const session = await getSession(client, conversationSessionId);
        // Request cancellation but keep consuming the stream. After cancel(),
        // the backend gracefully closes the SSE stream: it emits a terminal
        // turn.done event and then ends the stream, which lets the active run
        // drain to completion on its own instead of being torn down mid-flight.
        await session.cancel().catch(() => undefined);
        // Wait for the in-flight stream to finish draining. No explicit
        // reconcile is needed here — the cancelled turn is terminal and local
        // state reconciles against the event log on the next session load.
        await activeRunRef.current?.catch(() => undefined);
    }, [client, resolveConversationSessionId, sessionId, sessionOptions]);

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
                void sendTurn({ inputs }).catch((error) => onError?.(error));
            }
        },
        [onError, projectOptions, sendTurn],
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

            const turnIndex = findTurnIndex(committed, turnId);

            await cancel();

            const conversationSessionId = await resolveActiveSessionId(
                activeSessionId,
                resolveConversationSessionId,
            );
            const session = await getSession(client, conversationSessionId, sessionOptions);
            const previousTurnId = await resolveGatewayBranchPreviousTurnId(
                session,
                turnIndex,
            );
            const rewound = await buildSnapshotBeforeTurnIndex(
                session,
                turnIndex,
                listEventsConcurrency,
            );
            createdAtByMessageIdRef.current = new Map();
            setSnapshot(rewound);

            await sendTurn({
                userMessage,
                previousTurnId,
            });
        },
        [
            cancel,
            client,
            listEventsConcurrency,
            resolveConversationSessionId,
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

    return {
        messages,
        isRunning,
        isLoading,
        load,
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

