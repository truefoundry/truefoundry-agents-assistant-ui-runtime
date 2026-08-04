// @vitest-environment jsdom
import type { ThreadMessage } from "@assistant-ui/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentChatServer, Turn } from "./server/index.js";

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

const mockServer = {
    cancelSession: vi.fn().mockResolvedValue(undefined),
} as unknown as AgentChatServer;

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
        vi.mocked(mockServer.cancelSession).mockResolvedValue(undefined);
        vi.mocked(loadSessionSnapshot).mockResolvedValue(createEmptySessionSnapshot());
        vi.mocked(streamTurnContent).mockReturnValue(singleUpdateStream());
        vi.mocked(resumeTurnStream).mockReturnValue(singleUpdateStream());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("clears messages when sessionId is undefined", async () => {
        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: undefined }),
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.messages).toEqual([]);
        expect(loadSessionSnapshot).not.toHaveBeenCalled();
    });

    it("loads the initial URL session before it is marked as the main thread", async () => {
        renderHook(() =>
            useTrueFoundryAgentMessages({
                server: mockServer,
                sessionId: "session-from-url",
                isMain: false,
                isInitialSession: true,
            }),
        );

        await waitFor(() =>
            expect(loadSessionSnapshot).toHaveBeenCalledWith(
                mockServer,
                "session-from-url",
                expect.any(Function),
            ),
        );
    });

    it("does not load an inactive background thread", async () => {
        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({
                server: mockServer,
                sessionId: "background-session",
                isMain: false,
                isInitialSession: false,
            }),
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(loadSessionSnapshot).not.toHaveBeenCalled();
    });

    it("sendTurn lazily initializes a session when sessionId is undefined", async () => {
        const initializeSession = vi.fn().mockResolvedValue({
            remoteId: "session-new",
            externalId: undefined,
        });

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({
                server: mockServer,
                sessionId: undefined,
                initializeSession,
            }),
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.sendTurn({ userMessage: "hello there" });
        });

        expect(initializeSession).toHaveBeenCalledOnce();
        expect(streamTurnContent).toHaveBeenCalled();
        expect(loadSessionSnapshot).not.toHaveBeenCalled();
    });

    it("sendTurn forwards getTurnHeaders only when they resolve to a value", async () => {
        const getTurnHeaders = vi
            .fn()
            .mockResolvedValueOnce({
                "x-tfy-session-last-updated-at": "2026-06-30T12:00:00.000Z",
            })
            .mockResolvedValueOnce(undefined);

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({
                server: mockServer,
                sessionId: "session-1",
                getTurnHeaders,
            }),
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.sendTurn({ userMessage: "first" });
        });

        expect(getTurnHeaders).toHaveBeenCalledTimes(1);
        expect(streamTurnContent).toHaveBeenCalledWith(
            mockServer,
            "session-1",
            expect.any(PeerThreadFoldState),
            {
                userMessage: "first",
                headers: {
                    "x-tfy-session-last-updated-at": "2026-06-30T12:00:00.000Z",
                },
            },
            expect.any(AbortSignal),
            expect.any(Array),
            expect.any(Function),
        );

        await act(async () => {
            await result.current.sendTurn({ userMessage: "second" });
        });

        expect(getTurnHeaders).toHaveBeenCalledTimes(2);
        expect(streamTurnContent).toHaveBeenLastCalledWith(
            mockServer,
            "session-1",
            expect.any(PeerThreadFoldState),
            { userMessage: "second" },
            expect.any(AbortSignal),
            expect.any(Array),
            expect.any(Function),
        );
    });

    it("loads converted session history on mount", async () => {
        vi.mocked(loadSessionSnapshot).mockResolvedValue(
            snapshotWithUserTurn("hello"),
        );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(loadSessionSnapshot).toHaveBeenCalledWith(
            mockServer,
            "session-1",
            expect.any(Function),
        );
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
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
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

    it("clears isLoading while a resumed turn is still streaming", async () => {
        let releaseStream: (() => void) | undefined;
        vi.mocked(resumeTurnStream).mockReturnValue(
            (async function* () {
                await new Promise<void>((resolve) => {
                    releaseStream = resolve;
                });
                yield { content: [{ type: "text" as const, text: "streamed reply" }] };
            })(),
        );

        const runningTurn = {
            id: "turn-running",
            input: [{ type: "user.message", content: "keep going" }],
            createdAt: new Date().toISOString(),
        } as Turn;
        vi.mocked(loadSessionSnapshot).mockResolvedValue(
            replaceSessionSnapshot(createEmptySessionSnapshot(), {
                runningTurn,
                unstable_resume: true,
                pendingUser: {
                    turnId: runningTurn.id,
                    content: "keep going",
                    createdAt: new Date(runningTurn.createdAt),
                },
            }),
        );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(resumeTurnStream).toHaveBeenCalled();
        await waitFor(() => expect(result.current.isRunning).toBe(true));
        expect(result.current.messages[0]).toMatchObject({
            role: "user",
            content: [{ type: "text", text: "keep going" }],
        });

        await act(async () => {
            releaseStream?.();
        });
        await waitFor(() => expect(result.current.isRunning).toBe(false));
    });

    it("sendTurn appends a user message and streams the assistant reply", async () => {
        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
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

    it("editFromTurn drops prior turns before showing the edited user message", async () => {
        const createdAt = new Date().toISOString();
        const fold = new PeerThreadFoldState();
        ingestTurnEvent(fold, {
            type: "model.message",
            id: "model-1",
            createdAt,
            threadId: ROOT_THREAD_ID,
            role: "assistant",
            content: "How are you",
        } as never);

        vi.mocked(loadSessionSnapshot).mockResolvedValue({
            ...replaceSessionSnapshot(createEmptySessionSnapshot(), {
                turns: [
                    {
                        id: "turn-1",
                        userText: "Hello",
                        createdAt,
                        state: {
                            status: "done",
                            requiredActions: [],
                            completedAt: createdAt,
                        },
                        input: [{ type: "user.message", content: "Hello" }],
                        rootModelMessageIds: ["model-1"],
                    },
                ],
            }),
            fold,
        });
        let releaseStream: (() => void) | undefined;
        vi.mocked(streamTurnContent).mockReturnValue(
            (async function* () {
                yield {
                    content: [{ type: "text" as const, text: "sunny" }],
                };
                await new Promise<void>((resolve) => {
                    releaseStream = resolve;
                });
            })(),
        );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.messages.map((m) => m.role)).toEqual([
            "user",
            "assistant",
        ]);
        expect(result.current.messages[0]).toMatchObject({
            content: [{ type: "text", text: "Hello" }],
        });

        let editPromise: Promise<void>;
        await act(async () => {
            editPromise = result.current.editFromTurn(
                "turn-1",
                "what is the weather like?",
            );
            await Promise.resolve();
        });

        await waitFor(() => {
            const texts = result.current.messages
                .filter((m) => m.role === "user")
                .map((m) =>
                    m.content
                        .filter((p): p is { type: "text"; text: string } => p.type === "text")
                        .map((p) => p.text)
                        .join(""),
                );
            expect(texts).toEqual(["what is the weather like?"]);
        });
        expect(
            result.current.messages.some(
                (m) =>
                    m.role === "user" &&
                    m.content.some((p) => p.type === "text" && p.text === "Hello"),
            ),
        ).toBe(false);
        expect(
            result.current.messages.some(
                (m) =>
                    m.role === "assistant" &&
                    m.content.some(
                        (p) => p.type === "text" && p.text.includes("How are you"),
                    ),
            ),
        ).toBe(false);

        await act(async () => {
            releaseStream?.();
            await editPromise!;
        });
    });

    it("does not let a superseded stream complete the current stream", async () => {
        let releaseFirstStream: (() => void) | undefined;
        let releaseSecondStream: (() => void) | undefined;
        let nextAnimationFrame = 1;
        const animationFrames = new Map<number, FrameRequestCallback>();
        vi.stubGlobal(
            "requestAnimationFrame",
            vi.fn((callback: FrameRequestCallback) => {
                const frame = nextAnimationFrame++;
                animationFrames.set(frame, callback);
                return frame;
            }),
        );
        vi.stubGlobal(
            "cancelAnimationFrame",
            vi.fn((frame: number) => animationFrames.delete(frame)),
        );
        vi.mocked(streamTurnContent)
            .mockReturnValueOnce(
                (async function* () {
                    yield { content: [{ type: "text" as const, text: "first reply" }] };
                    await new Promise<void>((resolve) => {
                        releaseFirstStream = resolve;
                    });
                })(),
            )
            .mockReturnValueOnce(
                (async function* () {
                    yield { content: [{ type: "text" as const, text: "second reply" }] };
                    await new Promise<void>((resolve) => {
                        releaseSecondStream = resolve;
                    });
                })(),
            );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const firstSend = result.current.sendTurn({ userMessage: "first" });
        await waitFor(() => expect(streamTurnContent).toHaveBeenCalledTimes(1));

        const secondSend = result.current.sendTurn({ userMessage: "second" });
        await waitFor(() => expect(streamTurnContent).toHaveBeenCalledTimes(2));

        await act(async () => {
            releaseFirstStream?.();
            await firstSend;
        });

        expect(result.current.isRunning).toBe(true);

        await act(async () => {
            animationFrames.get(2)?.(performance.now());
        });
        expect(result.current.messages.at(-1)).toMatchObject({
            role: "assistant",
            content: [{ type: "text", text: "second reply" }],
        });
        expect(result.current.messages.at(-1)?.status).not.toMatchObject({
            type: "complete",
        });

        await act(async () => {
            releaseSecondStream?.();
            await secondSend;
        });
    });

    it("carries a streamed sandboxId through commit so it survives after the stream completes", async () => {
        vi.mocked(streamTurnContent).mockReturnValue(
            (async function* () {
                yield {
                    content: [{ type: "text" as const, text: "streamed reply" }],
                    metadata: { custom: { sandboxId: "sbx-123" } },
                };
            })(),
        );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.sendTurn({ userMessage: "hello there" });
        });

        expect(result.current.messages[1]).toMatchObject({
            role: "assistant",
            metadata: { custom: { sandboxId: "sbx-123" } },
        });
    });

    it("sendTurn with approvals streams a continuation without adding a user message", async () => {
        vi.mocked(loadSessionSnapshot).mockResolvedValue(
            snapshotWithAssistantMessage(assistantMessageWithPendingApproval()),
        );

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
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
            mockServer,
            "session-1",
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
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
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
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
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
            mockServer,
            "session-1",
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
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
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
        it("issues exactly one prepareAndExecuteTurn input batch across root and sub-agent threads", async () => {
            vi.mocked(loadSessionSnapshot).mockResolvedValue(
                snapshotWithAssistantMessage(assistantMessageWithMultiThreadPendingActions()),
            );

            const { result } = renderHook(() =>
                useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
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
                mockServer,
                "session-1",
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
                useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
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

    it("cancel drains the stream gracefully and calls cancelSession", async () => {
        let resolveStream: (() => void) | undefined;
        vi.mocked(streamTurnContent).mockReturnValue(
            (async function* () {
                yield { content: [{ type: "text" as const, text: "partial" }] };
                await new Promise<void>((resolve) => {
                    resolveStream = resolve;
                });
            })(),
        );
        // cancelSession makes the backend close the SSE stream gracefully,
        // which ends the active iterator on its own.
        vi.mocked(mockServer.cancelSession).mockImplementation(async () => {
            resolveStream?.();
        });

        const { result } = renderHook(() =>
            useTrueFoundryAgentMessages({ server: mockServer, sessionId: "session-1" }),
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

        expect(mockServer.cancelSession).toHaveBeenCalledWith({ sessionId: "session-1" });
        expect(result.current.isRunning).toBe(false);
        // No reconcile is triggered by cancel; the session was only loaded once
        // on mount and reconciles against the event log on the next page load.
        expect(loadSessionSnapshot).toHaveBeenCalledTimes(1);
    });

    describe("pre-turn failure rollback", () => {
        it("reports and restores a user message when initializeSession fails", async () => {
            const onError = vi.fn();
            const onPreTurnFailure = vi.fn();
            const initializeSession = vi
                .fn()
                .mockRejectedValue(new Error("Draft session creation failed"));

            const { result } = renderHook(() =>
                useTrueFoundryAgentMessages({
                    server: mockServer,
                    sessionId: undefined,
                    initializeSession,
                    onError,
                }),
            );

            await waitFor(() => expect(result.current.isLoading).toBe(false));
            expect(result.current.messages).toEqual([]);

            await act(async () => {
                await expect(
                    result.current.sendTurn({
                        userMessage: "test message",
                        onPreTurnFailure,
                    }),
                ).rejects.toThrow("Draft session creation failed");
            });

            expect(result.current.messages).toEqual([]);
            expect(onPreTurnFailure).toHaveBeenCalledOnce();
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
            expect(initializeSession).toHaveBeenCalledOnce();
            expect(streamTurnContent).not.toHaveBeenCalled();
        });

        it("rolls back when the turns stream fails before turn.created", async () => {
            const onError = vi.fn();
            const onPreTurnFailure = vi.fn();
            vi.mocked(streamTurnContent).mockImplementation(async function* () {
                throw new Error("Turn preparation failed");
            });

            const { result } = renderHook(() =>
                useTrueFoundryAgentMessages({
                    server: mockServer,
                    sessionId: "session-1",
                    onError,
                }),
            );

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            await act(async () => {
                await expect(
                    result.current.sendTurn({
                        userMessage: "test message",
                        onPreTurnFailure,
                    }),
                ).rejects.toThrow("Turn preparation failed");
            });

            expect(result.current.messages).toEqual([]);
            expect(onPreTurnFailure).toHaveBeenCalledOnce();
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });

        it("does not roll back after turn.created registers the user message", async () => {
            const onError = vi.fn();
            const onPreTurnFailure = vi.fn();
            vi.mocked(streamTurnContent).mockImplementation(
                async function* (
                    _server,
                    _sessionId,
                    _fold,
                    _options,
                    _signal,
                    _baseline,
                    onTurnIdAvailable,
                ) {
                    onTurnIdAvailable?.("gateway-turn-123");
                    yield { content: [{ type: "text" as const, text: "partial" }] };
                    throw new Error("Mid-stream error");
                },
            );

            const { result } = renderHook(() =>
                useTrueFoundryAgentMessages({
                    server: mockServer,
                    sessionId: "session-1",
                    onError,
                }),
            );

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            await act(async () => {
                await expect(
                    result.current.sendTurn({
                        userMessage: "test message",
                        onPreTurnFailure,
                    }),
                ).rejects.toThrow("Mid-stream error");
            });

            const userMessages = result.current.messages.filter((m) => m.role === "user");
            expect(userMessages).toHaveLength(1);
            expect(userMessages[0]?.content[0]).toMatchObject({
                type: "text",
                text: "test message",
            });
            expect(onPreTurnFailure).not.toHaveBeenCalled();
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });
    });
});
