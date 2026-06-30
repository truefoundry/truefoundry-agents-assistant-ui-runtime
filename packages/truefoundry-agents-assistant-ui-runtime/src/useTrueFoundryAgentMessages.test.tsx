// @vitest-environment jsdom
import type { ThreadMessage } from "@assistant-ui/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentSessionClient, Turn } from "truefoundry-gateway-sdk/agents";

import { ROOT_THREAD_ID } from "./constants.js";
import { collectPendingToolResponses } from "./collectPending.js";
import { loadSessionSnapshot } from "./loadSessionSnapshot.js";
import {
    buildRootAssistantContent,
    ingestTurnEvent,
    PeerThreadFoldState,
} from "./foldPeerThreads.js";
import {
    createEmptySessionSnapshot,
    replaceSessionSnapshot,
    type SessionSnapshot,
} from "./sessionSnapshot.js";
import { getSession } from "./sessions.js";
import { resumeTurnStream, streamTurnContent } from "./streamTurn.js";
import {
    messageHasPendingApprovals,
    TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY,
} from "./toolApproval.js";
import {
    messageHasPendingResponses,
    TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY,
    toolResponseMessageCustom,
    toolResponseStatus,
} from "./toolResponse.js";
import { useTrueFoundryAgentMessages } from "./useTrueFoundryAgentMessages.js";

vi.mock("./sessions.js", () => ({
    getSession: vi.fn(),
}));

vi.mock("./loadSessionSnapshot.js", () => ({
    loadSessionSnapshot: vi.fn(),
}));

vi.mock("./streamTurn.js", () => ({
    streamTurnContent: vi.fn(),
    resumeTurnStream: vi.fn(),
}));

vi.mock("./convertTurnMessages.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./convertTurnMessages.js")>();
    return actual;
});

const mockClient = {} as AgentSessionClient;

function snapshotWithAssistantMessage(
    message: Extract<ThreadMessage, { role: "assistant" }>,
    extra?: Partial<SessionSnapshot>,
): SessionSnapshot {
    const turnId = message.id.replace(/-assistant$/, "");
    return replaceSessionSnapshot(createEmptySessionSnapshot(), {
        activeStream: {
            turnId,
            isContinuation: false,
            update: {
                content: [...message.content],
                status: message.status,
                metadata: { custom: message.metadata.custom },
            },
        },
        ...extra,
    });
}

function snapshotWithUserTurn(userText: string): SessionSnapshot {
    const createdAt = new Date().toISOString();
    return replaceSessionSnapshot(createEmptySessionSnapshot(), {
        turns: [
            {
                id: "turn-1",
                userText,
                createdAt,
                state: {
                    status: "done",
                    requiredActions: [],
                    completedAt: createdAt,
                },
                input: [{ type: "user.message", content: userText }],
            },
        ],
    });
}

function snapshotWithAskUserPendingInFold(): SessionSnapshot {
    const fold = new PeerThreadFoldState();
    const turnId = "turn-ask";

    ingestTurnEvent(fold, {
        type: "model.message",
        id: "model-1",
        createdAt: new Date().toISOString(),
        threadId: ROOT_THREAD_ID,
        toolCalls: [
            {
                id: "question-1",
                type: "function",
                function: {
                    name: "ask_user_question",
                    arguments: JSON.stringify({
                        question: "Pick one",
                        options: ["A", "B"],
                    }),
                },
                toolInfo: { type: "truefoundry-system", name: "ask_user_question" },
            },
        ],
    });

    ingestTurnEvent(fold, {
        type: "tool.response_required",
        id: "resp-req-1",
        createdAt: new Date().toISOString(),
        threadId: ROOT_THREAD_ID,
        toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
    });

    const content = buildRootAssistantContent(fold);

    return replaceSessionSnapshot(createEmptySessionSnapshot(), {
        fold,
        pendingUser: {
            turnId,
            content: "ask me a question",
            createdAt: new Date(),
        },
        activeStream: {
            turnId,
            isContinuation: false,
            streamComplete: true,
            update: {
                content,
                status: toolResponseStatus(),
                metadata: { custom: toolResponseMessageCustom(ROOT_THREAD_ID) },
            },
        },
    });
}

function assistantMessageWithPendingApproval() {
    return {
        id: "turn-1-assistant",
        role: "assistant" as const,
        content: [
            {
                type: "tool-call" as const,
                toolCallId: "approval-1",
                toolName: "bash",
                args: {},
                argsText: "{}",
                approval: { id: "approval-1" },
            },
        ],
        status: { type: "requires-action" as const, reason: "tool-calls" as const },
        createdAt: new Date(),
        metadata: {
            unstable_state: null,
            unstable_annotations: [],
            unstable_data: [],
            steps: [],
            custom: { [TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY]: ROOT_THREAD_ID },
        },
    };
}

function assistantMessageWithPendingApprovalAndResponse() {
    return {
        id: "turn-1-assistant",
        role: "assistant" as const,
        content: [
            {
                type: "tool-call" as const,
                toolCallId: "approval-1",
                toolName: "bash",
                args: {},
                argsText: "{}",
                approval: { id: "approval-1" },
            },
            {
                type: "tool-call" as const,
                toolCallId: "question-1",
                toolName: "ask_user_question",
                args: {},
                argsText: "{}",
                interrupt: {
                    type: "human" as const,
                    payload: { question: "Pick one", options: ["A", "B"] },
                },
            },
        ],
        status: { type: "requires-action" as const, reason: "tool-calls" as const },
        createdAt: new Date(),
        metadata: {
            unstable_state: null,
            unstable_annotations: [],
            unstable_data: [],
            steps: [],
            custom: {
                [TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY]: ROOT_THREAD_ID,
                [TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY]: ROOT_THREAD_ID,
            },
        },
    };
}

function assistantMessageWithMultiThreadPendingActions() {
    return {
        id: "turn-1-assistant",
        role: "assistant" as const,
        content: [
            {
                type: "tool-call" as const,
                toolCallId: "spawn-1",
                toolName: "create_sub_agent",
                args: {},
                argsText: "{}",
                messages: [
                    {
                        id: "child-assistant",
                        role: "assistant" as const,
                        content: [
                            {
                                type: "tool-call" as const,
                                toolCallId: "question-sub",
                                toolName: "ask_user_question",
                                args: {},
                                argsText: "{}",
                                interrupt: {
                                    type: "human" as const,
                                    payload: { question: "Sub?" },
                                },
                            },
                        ],
                        status: {
                            type: "requires-action" as const,
                            reason: "tool-calls" as const,
                        },
                        createdAt: new Date(),
                        metadata: {
                            unstable_state: null,
                            unstable_annotations: [],
                            unstable_data: [],
                            steps: [],
                            custom: { [TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY]: "child-1" },
                        },
                    },
                ],
            },
            {
                type: "tool-call" as const,
                toolCallId: "approval-root",
                toolName: "bash",
                args: {},
                argsText: "{}",
                approval: { id: "approval-root" },
            },
        ],
        status: { type: "requires-action" as const, reason: "tool-calls" as const },
        createdAt: new Date(),
        metadata: {
            unstable_state: null,
            unstable_annotations: [],
            unstable_data: [],
            steps: [],
            custom: { [TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY]: ROOT_THREAD_ID },
        },
    };
}

async function* singleUpdateStream() {
    yield { content: [{ type: "text" as const, text: "streamed reply" }] };
}

describe("useTrueFoundryAgentMessages", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getSession).mockResolvedValue({} as never);
        vi.mocked(loadSessionSnapshot).mockResolvedValue(createEmptySessionSnapshot());
        vi.mocked(streamTurnContent).mockReturnValue(singleUpdateStream());
        vi.mocked(resumeTurnStream).mockReturnValue(singleUpdateStream());
    });

    it("clears messages when sessionId is undefined", async () => {
        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ client: mockClient, sessionId: undefined }),
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.messages).toEqual([]);
        expect(getSession).not.toHaveBeenCalled();
        expect(loadSessionSnapshot).not.toHaveBeenCalled();
    });

    it("sendTurn lazily initializes a session when sessionId is undefined", async () => {
        const initializeSession = vi.fn().mockResolvedValue({
            remoteId: "session-new",
            externalId: undefined,
        });

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({
                client: mockClient,
                sessionId: undefined,
                initializeSession,
            }),
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.sendTurn({ userMessage: "hello there" });
        });

        expect(initializeSession).toHaveBeenCalledOnce();
        expect(getSession).toHaveBeenCalledWith(mockClient, "session-new");
        expect(streamTurnContent).toHaveBeenCalled();
        expect(loadSessionSnapshot).not.toHaveBeenCalled();
    });

    it("loads converted session history on mount", async () => {
        vi.mocked(loadSessionSnapshot).mockResolvedValue(
            snapshotWithUserTurn("hello"),
        );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ client: mockClient, sessionId: "session-1" }),
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(loadSessionSnapshot).toHaveBeenCalledWith(mockClient, "session-1");
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0]?.role).toBe("user");
    });

    it("resumes a running turn after load", async () => {
        const runningTurn = { id: "turn-running" } as Turn;
        vi.mocked(loadSessionSnapshot).mockResolvedValue(
            replaceSessionSnapshot(createEmptySessionSnapshot(), {
                turns: [
                    {
                        id: runningTurn.id,
                        createdAt: new Date().toISOString(),
                        state: { status: "running" },
                        input: [],
                    },
                ],
                runningTurn,
                unstable_resume: true,
            }),
        );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ client: mockClient, sessionId: "session-1" }),
        );

        await waitFor(() => expect(result.current.isRunning).toBe(false));
        expect(resumeTurnStream).toHaveBeenCalled();
        await waitFor(() =>
            expect(result.current.messages.at(-1)).toMatchObject({
                role: "assistant",
                content: [{ type: "text", text: "streamed reply" }],
                status: { type: "complete", reason: "stop" },
            }),
        );
    });

    it("sendTurn appends a user message and streams the assistant reply", async () => {
        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ client: mockClient, sessionId: "session-1" }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.sendTurn({ userMessage: "hello there" });
        });

        expect(streamTurnContent).toHaveBeenCalled();
        expect(result.current.messages).toHaveLength(2);
        expect(result.current.messages[0]).toMatchObject({
            role: "user",
            content: [{ type: "text", text: "hello there" }],
        });
        expect(result.current.messages[1]).toMatchObject({
            role: "assistant",
            content: [{ type: "text", text: "streamed reply" }],
            status: { type: "complete", reason: "stop" },
        });
    });

    it("sendTurn with approvals streams a continuation without adding a user message", async () => {
        vi.mocked(loadSessionSnapshot).mockResolvedValue(
            snapshotWithAssistantMessage(assistantMessageWithPendingApproval()),
        );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ client: mockClient, sessionId: "session-1" }),
        );
        await waitFor(() => expect(result.current.messages).toHaveLength(1));

        await act(async () => {
            await result.current.sendTurn({
                inputs: [
                    {
                        type: "user.tool_approval",
                        threadId: ROOT_THREAD_ID,
                        toolCallId: "approval-1",
                        approval: { status: "allow" },
                    },
                ],
            });
        });

        expect(streamTurnContent).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(PeerThreadFoldState),
            {
                inputs: [
                    {
                        type: "user.tool_approval",
                        threadId: ROOT_THREAD_ID,
                        toolCallId: "approval-1",
                        approval: { status: "allow" },
                    },
                ],
            },
            expect.any(AbortSignal),
            expect.any(Array),
        );
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0]?.role).toBe("assistant");
    });

    it("respondToToolApproval records approval decisions on the pending tool call", async () => {
        vi.mocked(loadSessionSnapshot).mockResolvedValue(
            snapshotWithAssistantMessage(assistantMessageWithPendingApproval()),
        );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ client: mockClient, sessionId: "session-1" }),
        );
        await waitFor(() => expect(result.current.messages).toHaveLength(1));

        await act(async () => {
            result.current.respondToToolApproval({
                approvalId: "approval-1",
                approved: true,
            });
        });

        await waitFor(() => {
            const assistant = result.current.messages[0];
            expect(assistant?.role).toBe("assistant");
            if (assistant?.role !== "assistant") {
                return;
            }
            expect(messageHasPendingApprovals(assistant)).toBe(false);
            const toolCall = assistant.content[0];
            if (toolCall?.type !== "tool-call") {
                return;
            }
            expect(toolCall.approval?.approved).toBe(true);
        });

        expect(streamTurnContent).toHaveBeenCalled();
    });

    it("respondToToolApproval sends combined inputs only after responses are answered", async () => {
        vi.mocked(loadSessionSnapshot).mockResolvedValue(
            snapshotWithAssistantMessage(assistantMessageWithPendingApprovalAndResponse()),
        );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ client: mockClient, sessionId: "session-1" }),
        );
        await waitFor(() => expect(result.current.messages).toHaveLength(1));

        await act(async () => {
            result.current.respondToToolApproval({
                approvalId: "approval-1",
                approved: true,
            });
        });

        expect(streamTurnContent).not.toHaveBeenCalled();

        await act(async () => {
            result.current.respondToToolResponse({
                toolCallId: "question-1",
                content: "A",
            });
        });

        await waitFor(() => expect(streamTurnContent).toHaveBeenCalled());
        expect(streamTurnContent).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(PeerThreadFoldState),
            {
                inputs: [
                    {
                        type: "user.tool_approval",
                        threadId: ROOT_THREAD_ID,
                        toolCallId: "approval-1",
                        approval: { status: "allow" },
                    },
                    {
                        type: "user.tool_response",
                        threadId: ROOT_THREAD_ID,
                        toolCallId: "question-1",
                        content: "A",
                    },
                ],
            },
            expect.any(AbortSignal),
            expect.any(Array),
        );

        const assistant = result.current.messages[0];
        expect(assistant?.role).toBe("assistant");
        if (assistant?.role !== "assistant") {
            return;
        }
        expect(messageHasPendingApprovals(assistant)).toBe(false);
        expect(messageHasPendingResponses(assistant)).toBe(false);
    });

    it("keeps ask-user resolved after respond and stream completion clears overlay", async () => {
        vi.mocked(loadSessionSnapshot).mockResolvedValue(
            snapshotWithAskUserPendingInFold(),
        );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ client: mockClient, sessionId: "session-1" }),
        );
        await waitFor(() => expect(result.current.messages).toHaveLength(2));
        expect(collectPendingToolResponses(result.current.messages)).toHaveLength(1);

        await act(async () => {
            result.current.respondToToolResponse({
                toolCallId: "question-1",
                content: "A",
            });
        });

        await waitFor(() => expect(streamTurnContent).toHaveBeenCalled());
        await waitFor(() => expect(result.current.isRunning).toBe(false));

        expect(collectPendingToolResponses(result.current.messages)).toHaveLength(0);
        const assistant = result.current.messages.find((m) => m.role === "assistant");
        expect(assistant).toBeDefined();
        expect(messageHasPendingResponses(assistant)).toBe(false);
    });

    describe("batched resume invariant", () => {
        it("issues exactly one prepareTurn input batch across root and sub-agent threads", async () => {
            vi.mocked(loadSessionSnapshot).mockResolvedValue(
                snapshotWithAssistantMessage(assistantMessageWithMultiThreadPendingActions()),
            );

            const { result } = renderHook(() =>
                useTrueFoundryAgentMessages({ client: mockClient, sessionId: "session-1" }),
            );
            await waitFor(() => expect(result.current.messages).toHaveLength(1));

            await act(async () => {
                result.current.respondToToolResponse({
                    toolCallId: "question-sub",
                    content: "sub-answer",
                });
            });
            expect(streamTurnContent).not.toHaveBeenCalled();

            await act(async () => {
                result.current.respondToToolApproval({
                    approvalId: "approval-root",
                    approved: true,
                });
            });

            await waitFor(() => expect(streamTurnContent).toHaveBeenCalledTimes(1));
            expect(streamTurnContent).toHaveBeenCalledWith(
                expect.anything(),
                expect.any(PeerThreadFoldState),
                {
                    inputs: [
                        {
                            type: "user.tool_approval",
                            threadId: ROOT_THREAD_ID,
                            toolCallId: "approval-root",
                            approval: { status: "allow" },
                        },
                        {
                            type: "user.tool_response",
                            threadId: "child-1",
                            toolCallId: "question-sub",
                            content: "sub-answer",
                        },
                    ],
                },
                expect.any(AbortSignal),
                expect.any(Array),
            );
        });

        it("does not resume after the first resolved action when another is still pending", async () => {
            vi.mocked(loadSessionSnapshot).mockResolvedValue(
                snapshotWithAssistantMessage(assistantMessageWithPendingApprovalAndResponse()),
            );

            const { result } = renderHook(() =>
                useTrueFoundryAgentMessages({ client: mockClient, sessionId: "session-1" }),
            );
            await waitFor(() => expect(result.current.messages).toHaveLength(1));

            await act(async () => {
                result.current.respondToToolResponse({
                    toolCallId: "question-1",
                    content: "A",
                });
            });

            expect(streamTurnContent).not.toHaveBeenCalled();
            expect(messageHasPendingApprovals(result.current.messages[0]!)).toBe(true);
            expect(messageHasPendingResponses(result.current.messages[0]!)).toBe(false);
        });
    });

    it("cancel drains the stream gracefully and calls session.cancel", async () => {
        let resolveStream: (() => void) | undefined;
        vi.mocked(streamTurnContent).mockReturnValue(
            (async function* () {
                yield { content: [{ type: "text" as const, text: "partial" }] };
                await new Promise<void>((resolve) => {
                    resolveStream = resolve;
                });
            })(),
        );
        // session.cancel() makes the backend close the SSE stream gracefully,
        // which ends the active iterator on its own.
        const cancel = vi.fn().mockImplementation(async () => {
            resolveStream?.();
        });
        vi.mocked(getSession).mockResolvedValue({ cancel } as never);

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ client: mockClient, sessionId: "session-1" }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let sendPromise: Promise<void> | undefined;
        await act(async () => {
            sendPromise = result.current.sendTurn({ userMessage: "hello" });
        });
        await waitFor(() => expect(result.current.isRunning).toBe(true));

        await act(async () => {
            await result.current.cancel();
            await sendPromise;
        });

        expect(cancel).toHaveBeenCalled();
        expect(result.current.isRunning).toBe(false);
        // No reconcile is triggered by cancel; the session was only loaded once
        // on mount and reconciles against the event log on the next page load.
        expect(loadSessionSnapshot).toHaveBeenCalledTimes(1);
    });
});
