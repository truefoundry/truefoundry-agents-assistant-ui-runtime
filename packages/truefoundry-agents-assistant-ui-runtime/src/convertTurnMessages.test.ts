import { describe, expect, it, vi } from "vitest";
import type { AppendMessage } from "@assistant-ui/core";
import type {
    AgentSession,
    ModelMessageEvent,
    SandboxCreatedEvent,
    ThreadCreatedEvent,
    ToolApprovalRequiredEvent,
    ToolResponseRequiredEvent,
    Turn,
    TurnCreatedEvent,
    TurnDoneEvent,
    TurnEvent,
    TurnStreamData,
} from "truefoundry-gateway-sdk/agents";

import { ROOT_THREAD_ID } from "./constants.js";
import { collectPendingToolResponses } from "./collectPending.js";
import {
    buildSnapshotBeforeTurnIndex,
    buildSnapshotFromSessionEvents,
    buildTurnAssistantContent,
    buildUserMessageContent,
    buildUserMessageFromTurnInput,
    convertTurnsToThreadMessages,
    getTurnMessageContent,
    prependOlderSessionHistory,
    projectSessionMessages,
    repositoryItemsFromMessages,
    streamTurnEvents,
    turnStreamUpdateToAssistantMessage,
} from "./convertTurnMessages.js";
import { PeerThreadFoldState, buildRootAssistantContent, ingestTurnEvent } from "./foldPeerThreads.js";
import { findPausedAssistantMessage } from "./requiredActionInputs.js";
import {
    createEmptySessionSnapshot,
    replaceSessionSnapshot,
} from "./sessionSnapshot.js";
import { TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY } from "./toolApproval.js";
import {
    applyUserToolResponsesToFold,
    TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY,
    toolResponseStatus,
} from "./toolResponse.js";
import type { TurnStreamUpdate } from "./turnStreamUpdate.js";

const createdAt = new Date().toISOString();

function modelMessage(
    event: Omit<ModelMessageEvent, "type" | "createdAt">,
): ModelMessageEvent {
    return { type: "model.message", createdAt, ...event };
}

function approvalRequired(
    event: Omit<ToolApprovalRequiredEvent, "type" | "createdAt">,
): ToolApprovalRequiredEvent {
    return { type: "tool.approval_required", createdAt, ...event };
}

function threadCreated(
    event: Omit<ThreadCreatedEvent, "type" | "createdAt">,
): ThreadCreatedEvent {
    return { type: "thread.created", createdAt, ...event };
}

function sandboxCreated(
    event: Omit<SandboxCreatedEvent, "type" | "createdAt">,
): SandboxCreatedEvent {
    return { type: "sandbox.created", createdAt, ...event };
}

function responseRequired(
    event: Omit<ToolResponseRequiredEvent, "type" | "createdAt">,
): ToolResponseRequiredEvent {
    return { type: "tool.response_required", createdAt, ...event };
}

async function* streamFrom(
    events: TurnStreamData["event"][],
): AsyncGenerator<TurnStreamData> {
    for (const [index, event] of events.entries()) {
        yield { sequenceNumber: index + 1, event };
    }
}

function eventsPage(events: TurnEvent[]) {
    return async () => ({
        async *[Symbol.asyncIterator]() {
            for (const event of events) {
                yield event;
            }
        },
    });
}

function turnsPage(turns: Turn[]) {
    return async () => ({
        data: turns,
        response: {
            data: turns,
            pagination: { limit: turns.length || 1 },
        },
        hasNextPage: () => false,
        async *[Symbol.asyncIterator]() {
            for (const turn of turns) {
                yield turn;
            }
        },
    });
}

function appendUserMessage(
    content: AppendMessage["content"],
    attachments: AppendMessage["attachments"] = [],
): AppendMessage {
    return {
        role: "user",
        content,
        attachments,
        createdAt: new Date(),
        metadata: { custom: {} },
        parentId: null,
        sourceId: null,
        runConfig: undefined,
    };
}

function mockTurn(
    overrides: Partial<Turn> & Pick<Turn, "id" | "createdAt">,
): Pick<Turn, "id" | "createdAt" | "input" | "state" | "listEvents"> {
    return {
        input: [{ type: "user.message", content: "hello" }],
        state: { status: "done", requiredActions: [], completedAt: createdAt },
        listEvents: eventsPage([
            modelMessage({
                id: "m1",
                threadId: ROOT_THREAD_ID,
                content: "assistant reply",
            }),
        ]) as unknown as Turn["listEvents"],
        ...overrides,
    };
}

async function collectTurnListEvents(
    turn: Pick<Turn, "listEvents">,
): Promise<TurnEvent[]> {
    const events: TurnEvent[] = [];
    for await (const event of await turn.listEvents()) {
        events.push(event as TurnEvent);
    }
    return events;
}

/**
 * Builds session-level event items from per-turn mocks — newest-first turns,
 * running turns excluded (matches session.listEvents API contract).
 */
async function sessionEventItemsFromTurns(
    turnsNewestFirst: ReturnType<typeof mockTurn>[],
    lastTurnId?: string,
): Promise<{ turnId: string; event: TurnCreatedEvent | TurnDoneEvent | TurnEvent }[]> {
    let chain = turnsNewestFirst.filter((turn) => turn.state.status !== "running");
    if (lastTurnId != null) {
        const anchorIndex = chain.findIndex((turn) => turn.id === lastTurnId);
        chain = anchorIndex === -1 ? [] : chain.slice(anchorIndex);
    }

    const items: { turnId: string; event: TurnCreatedEvent | TurnDoneEvent | TurnEvent }[] =
        [];
    for (const turn of [...chain].reverse()) {
        items.push({
            turnId: turn.id,
            event: {
                type: "turn.created",
                id: `created-${turn.id}`,
                turnId: turn.id,
                input: turn.input,
                state: { status: "running" },
                createdBy: { subjectId: "u1", subjectType: "user" },
                createdAt: turn.createdAt,
            },
        });
        for (const event of await collectTurnListEvents(turn as Turn)) {
            items.push({ turnId: turn.id, event });
        }
        items.push({
            turnId: turn.id,
            event: {
                type: "turn.done",
                id: `done-${turn.id}`,
                state: turn.state as TurnDoneEvent["state"],
                createdAt: turn.createdAt,
            },
        });
    }
    return items;
}

function mockSession(turns: ReturnType<typeof mockTurn>[]): AgentSession {
    return {
        listTurns: turnsPage(turns as Turn[]) as unknown as AgentSession["listTurns"],
        listEvents: async (opts?: { lastTurnId?: string; pageToken?: string; limit?: number }) => {
            const items = await sessionEventItemsFromTurns(turns, opts?.lastTurnId);
            const newestFirst = [...items].reverse();
            return {
                data: newestFirst,
                response: {
                    data: newestFirst,
                    pagination: { limit: newestFirst.length || 1 },
                },
                hasNextPage: () => false,
                async *[Symbol.asyncIterator]() {
                    for (const item of newestFirst) {
                        yield item;
                    }
                },
            };
        },
    } as unknown as AgentSession;
}

async function collectStream<T>(stream: AsyncGenerator<T>): Promise<T[]> {
    const items: T[] = [];
    for await (const item of stream) {
        items.push(item);
    }
    return items;
}

describe("convertTurnMessages", () => {
    describe("getTurnMessageContent", () => {
        it("joins text parts from append message content", () => {
            expect(
                getTurnMessageContent(
                    appendUserMessage([
                        { type: "text", text: "line one" },
                        { type: "text", text: "line two" },
                    ]),
                ),
            ).toBe("line one\nline two");
        });

        it("throws when no text content is present", () => {
            expect(() => getTurnMessageContent(appendUserMessage([]))).toThrow(
                "User message must contain text content.",
            );
        });
    });

    describe("buildUserMessageContent", () => {
        it("returns a bare string for text-only messages", () => {
            expect(
                buildUserMessageContent(
                    appendUserMessage([{ type: "text", text: "hello there" }]),
                ),
            ).toBe("hello there");
        });

        it("forwards file attachments as gateway file parts", () => {
            expect(
                buildUserMessageContent(
                    appendUserMessage(
                        [{ type: "text", text: "see attached" }],
                        [
                            {
                                id: "att-1",
                                type: "file",
                                name: "doc.pdf",
                                contentType: "application/pdf",
                                status: { type: "complete" },
                                content: [
                                    {
                                        type: "file",
                                        mimeType: "application/pdf",
                                        data: "JVBERi0xLjQK",
                                    },
                                ],
                            },
                        ],
                    ),
                ),
            ).toEqual([
                { type: "text", text: "see attached" },
                {
                    type: "file",
                    name: "doc.pdf",
                    data: "data:application/pdf;base64,JVBERi0xLjQK",
                },
            ]);
        });

        it("passes through data URIs unchanged", () => {
            const dataUri = "data:application/pdf;base64,JVBERi0xLjQK";
            expect(
                buildUserMessageContent(
                    appendUserMessage(
                        [{ type: "text", text: "file" }],
                        [
                            {
                                id: "att-1",
                                type: "file",
                                name: "doc.pdf",
                                contentType: "application/pdf",
                                status: { type: "complete" },
                                content: [
                                    {
                                        type: "file",
                                        mimeType: "application/pdf",
                                        data: dataUri,
                                    },
                                ],
                            },
                        ],
                    ),
                ),
            ).toEqual([
                { type: "text", text: "file" },
                {
                    type: "file",
                    name: "doc.pdf",
                    data: dataUri,
                },
            ]);
        });

        it("maps image parts to gateway file parts", () => {
            expect(
                buildUserMessageContent(
                    appendUserMessage(
                        [{ type: "text", text: "image" }],
                        [
                            {
                                id: "att-1",
                                type: "image",
                                name: "photo.png",
                                contentType: "image/png",
                                status: { type: "complete" },
                                content: [
                                    {
                                        type: "image",
                                        image: "data:image/png;base64,AAAA",
                                    },
                                ],
                            },
                        ],
                    ),
                ),
            ).toEqual([
                { type: "text", text: "image" },
                {
                    type: "file",
                    name: "photo.png",
                    data: "data:image/png;base64,AAAA",
                },
            ]);
        });

        it("includes file parts from message content and attachments", () => {
            expect(
                buildUserMessageContent(
                    appendUserMessage(
                        [
                            { type: "text", text: "inline" },
                            {
                                type: "file",
                                mimeType: "application/pdf",
                                data: "AAAA",
                                filename: "inline.pdf",
                            },
                        ],
                        [
                            {
                                id: "att-1",
                                type: "file",
                                name: "attached.pdf",
                                contentType: "application/pdf",
                                status: { type: "complete" },
                                content: [
                                    {
                                        type: "file",
                                        mimeType: "application/pdf",
                                        data: "BBBB",
                                    },
                                ],
                            },
                        ],
                    ),
                ),
            ).toEqual([
                { type: "text", text: "inline" },
                {
                    type: "file",
                    name: "inline.pdf",
                    data: "data:application/pdf;base64,AAAA",
                },
                {
                    type: "file",
                    name: "attached.pdf",
                    data: "data:application/pdf;base64,BBBB",
                },
            ]);
        });
    });

    describe("buildUserMessageFromTurnInput", () => {
        it("maps gateway file parts to assistant-ui attachments", () => {
            const message = buildUserMessageFromTurnInput(
                "turn-1",
                [
                    {
                        type: "user.message",
                        content: [
                            { type: "text", text: "see attached" },
                            {
                                type: "file",
                                name: "doc.pdf",
                                data: "data:application/pdf;base64,JVBERi0xLjQK",
                            },
                        ],
                    },
                ],
                createdAt,
            );

            expect(message.role).toBe("user");
            expect(message.content).toEqual([{ type: "text", text: "see attached" }]);
            if (message.role !== "user") {
                return;
            }
            expect(message.attachments).toHaveLength(1);
            expect(message.attachments[0]?.name).toBe("doc.pdf");
        });

        it("maps gateway image_url parts to assistant-ui image attachments", () => {
            const message = buildUserMessageFromTurnInput(
                "turn-1",
                [
                    {
                        type: "user.message",
                        content: [
                            { type: "text", text: "see attached" },
                            {
                                type: "image_url",
                                image_url: {
                                    url: "data:image/jpeg;base64,/9j/4AAQ",
                                },
                            },
                        ] as never,
                    },
                ],
                createdAt,
            );

            if (message.role !== "user") {
                throw new Error("expected user message");
            }
            expect(message.attachments).toHaveLength(1);
            expect(message.attachments[0]?.type).toBe("image");
            expect(message.attachments[0]?.content[0]).toMatchObject({
                type: "image",
                image: "data:image/jpeg;base64,/9j/4AAQ",
            });
        });
    });

    describe("turnStreamUpdateToAssistantMessage", () => {
        it("creates a new assistant message when none exists", () => {
            const message = turnStreamUpdateToAssistantMessage("turn-1", {
                content: [{ type: "text", text: "hi" }],
            });
            expect(message.id).toBe("turn-1-assistant");
            expect(message.role).toBe("assistant");
            expect(message.status).toEqual({ type: "running" });
        });

        it("preserves the existing assistant message id on update", () => {
            const existing = turnStreamUpdateToAssistantMessage("turn-1", {
                content: [{ type: "text", text: "first" }],
            });
            const updated = turnStreamUpdateToAssistantMessage(
                "turn-1",
                { content: [{ type: "text", text: "second" }] },
                existing,
            );
            expect(updated.id).toBe(existing.id);
            expect(updated.content).toEqual([{ type: "text", text: "second" }]);
        });
    });

    describe("repositoryItemsFromMessages", () => {
        it("chains parent ids in order", () => {
            const userMessage = {
                id: "u1",
                role: "user" as const,
                content: [{ type: "text" as const, text: "hi" }],
                attachments: [],
                createdAt: new Date(),
                metadata: { custom: {} },
            };
            const assistant = turnStreamUpdateToAssistantMessage("t1", {
                content: [{ type: "text", text: "a" }],
            });

            const items = repositoryItemsFromMessages([userMessage, assistant]);
            expect(items).toEqual([
                { parentId: null, message: userMessage },
                { parentId: "u1", message: assistant },
            ]);
        });
    });

    describe("buildTurnAssistantContent", () => {
        it("aggregates turn listEvents into root assistant content", async () => {
            const content = await buildTurnAssistantContent(
                mockTurn({
                    id: "turn-1",
                    createdAt,
                }),
            );
            expect(content).toEqual([{ type: "text", text: "assistant reply" }]);
        });
    });

    describe("convertTurnsToThreadMessages", () => {
        it("builds user and assistant messages from completed turns", async () => {
            const result = await convertTurnsToThreadMessages(
                mockSession([
                    mockTurn({
                        id: "turn-1",
                        createdAt,
                        input: [{ type: "user.message", content: "hello" }],
                    }),
                ]),
            );

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0]).toMatchObject({
                id: "turn-1-user",
                role: "user",
                content: [{ type: "text", text: "hello" }],
            });
            expect(result.messages[1]).toMatchObject({
                id: "turn-1-assistant",
                role: "assistant",
                content: [{ type: "text", text: "assistant reply" }],
                status: { type: "complete", reason: "stop" },
            });
            expect(result.runningTurn).toBeUndefined();
        });

        it("carries sandboxId from a historical sandbox.created event onto the assistant message", async () => {
            const result = await convertTurnsToThreadMessages(
                mockSession([
                    mockTurn({
                        id: "turn-1",
                        createdAt,
                        input: [{ type: "user.message", content: "hello" }],
                        listEvents: eventsPage([
                            sandboxCreated({ id: "sandbox-evt", sandboxId: "sbx-123" }),
                            modelMessage({
                                id: "m1",
                                threadId: ROOT_THREAD_ID,
                                content: "assistant reply",
                            }),
                        ]) as unknown as Turn["listEvents"],
                    }),
                ]),
            );

            expect(result.messages[1]).toMatchObject({
                role: "assistant",
                metadata: { custom: { sandboxId: "sbx-123" } },
            });
        });

        it("returns runningTurn and unstable_resume for an in-flight turn", async () => {
            const runningTurn = mockTurn({
                id: "turn-running",
                createdAt,
                state: { status: "running" },
            });
            const result = await convertTurnsToThreadMessages(mockSession([runningTurn]));

            expect(result.runningTurn).toBe(runningTurn);
            expect(result.unstable_resume).toBe(true);
            expect(result.messages.at(-1)?.role).toBe("assistant");
        });

        it("merges continuation turns without user input into the last assistant message", async () => {
            const firstTurn = mockTurn({
                id: "turn-1",
                createdAt,
                listEvents: eventsPage([
                    modelMessage({
                        id: "m1",
                        threadId: ROOT_THREAD_ID,
                        content: "first chunk",
                    }),
                ]) as unknown as Turn["listEvents"],
            });
            const continuationTurn = mockTurn({
                id: "turn-2",
                createdAt,
                input: [{ type: "user.tool_approval", threadId: ROOT_THREAD_ID, toolCallId: "tc-1", approval: { status: "allow" } }],
                listEvents: eventsPage([
                    modelMessage({
                        id: "m2",
                        threadId: ROOT_THREAD_ID,
                        content: " after approval",
                    }),
                ]) as unknown as Turn["listEvents"],
            });

            const result = await convertTurnsToThreadMessages(
                mockSession([continuationTurn, firstTurn]),
            );

            expect(result.messages).toHaveLength(2);
            const assistant = result.messages[1];
            expect(assistant?.role).toBe("assistant");
            if (assistant?.role !== "assistant") {
                return;
            }
            expect(assistant.content).toEqual([
                { type: "text", text: "first chunk" },
                { type: "text", text: " after approval" },
            ]);
        });

        it("preserves requires-action on reload when a turn ends awaiting tool approval", async () => {
            const pausedTurn = mockTurn({
                id: "turn-approval",
                createdAt,
                input: [{ type: "user.message", content: "run tool" }],
                state: {
                    status: "done",
                    output: null,
                    requiredActions: [
                        approvalRequired({
                            id: "approval-event",
                            threadId: ROOT_THREAD_ID,
                            toolCalls: [{ id: "approval-1", sourceEventId: "m1" }],
                        }),
                    ],
                    completedAt: createdAt,
                },
                listEvents: eventsPage([
                    modelMessage({
                        id: "m1",
                        threadId: ROOT_THREAD_ID,
                        content: "run tool",
                        toolCalls: [
                            {
                                id: "approval-1",
                                type: "function",
                                function: { name: "bash", arguments: "{}" },
                                toolInfo: {
                                    type: "mcp",
                                    name: "bash",
                                    serverId: "bash-server",
                                    serverName: "bash",
                                },
                            },
                        ],
                    }),
                    approvalRequired({
                        id: "approval-event",
                        threadId: ROOT_THREAD_ID,
                        toolCalls: [{ id: "approval-1", sourceEventId: "m1" }],
                    }),
                ]) as unknown as Turn["listEvents"],
            });

            const result = await convertTurnsToThreadMessages(mockSession([pausedTurn]));

            expect(result.messages).toHaveLength(2);
            const assistant = result.messages[1];
            expect(assistant?.role).toBe("assistant");
            if (assistant?.role !== "assistant") {
                return;
            }
            expect(assistant.status).toEqual({
                type: "requires-action",
                reason: "tool-calls",
            });
            expect(assistant.metadata.custom[TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY]).toBe(
                ROOT_THREAD_ID,
            );
            expect(assistant.content.find((part) => part.type === "tool-call")).toMatchObject({
                type: "tool-call",
                toolCallId: "approval-1",
                approval: { id: "approval-1" },
            });
            expect(findPausedAssistantMessage(result.messages)).toBe(assistant);
        });

        it("downgrades to complete after a later turn submits user.tool_approval", async () => {
            const pausedTurn = mockTurn({
                id: "turn-approval",
                createdAt,
                input: [{ type: "user.message", content: "run tool" }],
                state: {
                    status: "done",
                    output: null,
                    requiredActions: [
                        approvalRequired({
                            id: "approval-event",
                            threadId: ROOT_THREAD_ID,
                            toolCalls: [{ id: "approval-1", sourceEventId: "m1" }],
                        }),
                    ],
                    completedAt: createdAt,
                },
                listEvents: eventsPage([
                    modelMessage({
                        id: "m1",
                        threadId: ROOT_THREAD_ID,
                        content: "run tool",
                        toolCalls: [
                            {
                                id: "approval-1",
                                type: "function",
                                function: { name: "bash", arguments: "{}" },
                                toolInfo: {
                                    type: "mcp",
                                    name: "bash",
                                    serverId: "bash-server",
                                    serverName: "bash",
                                },
                            },
                        ],
                    }),
                    approvalRequired({
                        id: "approval-event",
                        threadId: ROOT_THREAD_ID,
                        toolCalls: [{ id: "approval-1", sourceEventId: "m1" }],
                    }),
                ]) as unknown as Turn["listEvents"],
            });
            const continuationTurn = mockTurn({
                id: "turn-approval-resume",
                createdAt,
                input: [
                    {
                        type: "user.tool_approval",
                        threadId: ROOT_THREAD_ID,
                        toolCallId: "approval-1",
                        approval: { status: "allow" },
                    },
                ],
                listEvents: eventsPage([
                    modelMessage({
                        id: "m2",
                        threadId: ROOT_THREAD_ID,
                        content: "done",
                    }),
                ]) as unknown as Turn["listEvents"],
            });

            const result = await convertTurnsToThreadMessages(
                mockSession([continuationTurn, pausedTurn]),
            );

            const assistant = result.messages[1];
            expect(assistant?.role).toBe("assistant");
            if (assistant?.role !== "assistant") {
                return;
            }
            expect(assistant.status).toEqual({ type: "complete", reason: "stop" });
            expect(
                assistant.metadata.custom[TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY],
            ).toBeUndefined();
            const toolCall = assistant.content.find((part) => part.type === "tool-call");
            expect(toolCall?.type).toBe("tool-call");
            if (toolCall?.type !== "tool-call") {
                return;
            }
            expect(toolCall.approval?.approved).toBe(true);
        });

        it("preserves requires-action on reload when a turn ends awaiting tool response", async () => {
            const pausedTurn = mockTurn({
                id: "turn-response",
                createdAt,
                input: [{ type: "user.message", content: "ask me" }],
                state: {
                    status: "done",
                    output: null,
                    requiredActions: [
                        responseRequired({
                            id: "resp-req-1",
                            threadId: ROOT_THREAD_ID,
                            toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
                        }),
                    ],
                    completedAt: createdAt,
                },
                listEvents: eventsPage([
                    modelMessage({
                        id: "model-1",
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
                                toolInfo: {
                                    type: "truefoundry-system",
                                    name: "ask_user_question",
                                },
                            },
                        ],
                    }),
                    responseRequired({
                        id: "resp-req-1",
                        threadId: ROOT_THREAD_ID,
                        toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
                    }),
                ]) as unknown as Turn["listEvents"],
            });

            const result = await convertTurnsToThreadMessages(mockSession([pausedTurn]));

            const assistant = result.messages[1];
            expect(assistant?.role).toBe("assistant");
            if (assistant?.role !== "assistant") {
                return;
            }
            expect(assistant.status).toEqual({
                type: "requires-action",
                reason: "tool-calls",
            });
            expect(assistant.metadata.custom[TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY]).toBe(
                ROOT_THREAD_ID,
            );
            expect(assistant.content[0]).toMatchObject({
                type: "tool-call",
                toolCallId: "question-1",
                interrupt: {
                    type: "human",
                    payload: { question: "Pick one", options: ["A", "B"] },
                },
            });
            expect(findPausedAssistantMessage(result.messages)).toBe(assistant);
        });

        it("downgrades to complete after a later turn submits user.tool_response", async () => {
            const pausedTurn = mockTurn({
                id: "turn-response",
                createdAt,
                input: [{ type: "user.message", content: "ask me" }],
                state: {
                    status: "done",
                    output: null,
                    requiredActions: [
                        responseRequired({
                            id: "resp-req-1",
                            threadId: ROOT_THREAD_ID,
                            toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
                        }),
                    ],
                    completedAt: createdAt,
                },
                listEvents: eventsPage([
                    modelMessage({
                        id: "model-1",
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
                                toolInfo: {
                                    type: "truefoundry-system",
                                    name: "ask_user_question",
                                },
                            },
                        ],
                    }),
                    responseRequired({
                        id: "resp-req-1",
                        threadId: ROOT_THREAD_ID,
                        toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
                    }),
                ]) as unknown as Turn["listEvents"],
            });
            const continuationTurn = mockTurn({
                id: "turn-response-resume",
                createdAt,
                input: [
                    {
                        type: "user.tool_response",
                        threadId: ROOT_THREAD_ID,
                        toolCallId: "question-1",
                        content: "A",
                    },
                ],
                listEvents: eventsPage([
                    modelMessage({
                        id: "model-2",
                        threadId: ROOT_THREAD_ID,
                        content: "Thanks",
                    }),
                ]) as unknown as Turn["listEvents"],
            });

            const result = await convertTurnsToThreadMessages(
                mockSession([continuationTurn, pausedTurn]),
            );

            const assistant = result.messages[1];
            expect(assistant?.role).toBe("assistant");
            if (assistant?.role !== "assistant") {
                return;
            }
            expect(assistant.status).toEqual({ type: "complete", reason: "stop" });
            expect(
                assistant.metadata.custom[TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY],
            ).toBeUndefined();
            const toolCall = assistant.content[0];
            expect(toolCall?.type).toBe("tool-call");
            if (toolCall?.type !== "tool-call") {
                return;
            }
            expect(toolCall.result).toBe("A");
        });

        it("scopes assistant content to each user turn group", async () => {
            const helloTurn = mockTurn({
                id: "turn-hello",
                createdAt,
                input: [{ type: "user.message", content: "hello" }],
                listEvents: eventsPage([
                    modelMessage({
                        id: "m-hello",
                        threadId: ROOT_THREAD_ID,
                        content: "Hello! How can I help?",
                    }),
                ]) as unknown as Turn["listEvents"],
            });
            const analyzeTurn = mockTurn({
                id: "turn-analyze",
                createdAt,
                input: [{ type: "user.message", content: "analyze" }],
                listEvents: eventsPage([
                    modelMessage({
                        id: "m-analyze",
                        threadId: ROOT_THREAD_ID,
                        content: "Let me look at the file.",
                    }),
                ]) as unknown as Turn["listEvents"],
            });
            const ticketsTurn = mockTurn({
                id: "turn-tickets",
                createdAt,
                input: [
                    {
                        type: "user.message",
                        content: "create linear tickets",
                    },
                ],
                listEvents: eventsPage([
                    modelMessage({
                        id: "m-tickets",
                        threadId: ROOT_THREAD_ID,
                        content: "Creating tickets now.",
                    }),
                ]) as unknown as Turn["listEvents"],
            });

            const result = await convertTurnsToThreadMessages(
                mockSession([ticketsTurn, analyzeTurn, helloTurn]),
            );

            expect(result.messages).toHaveLength(6);
            expect(result.messages[1]).toMatchObject({
                id: "turn-hello-assistant",
                role: "assistant",
                content: [{ type: "text", text: "Hello! How can I help?" }],
            });
            expect(result.messages[3]).toMatchObject({
                id: "turn-analyze-assistant",
                role: "assistant",
                content: [{ type: "text", text: "Let me look at the file." }],
            });
            expect(result.messages[5]).toMatchObject({
                id: "turn-tickets-assistant",
                role: "assistant",
                content: [{ type: "text", text: "Creating tickets now." }],
            });
        });

        it("projects file attachments on user messages from turn input", async () => {
            const fileData = "data:text/x-python;base64,cHJpbnQoJ2hlbGxvJyk=";
            const analyzeTurn = mockTurn({
                id: "turn-analyze",
                createdAt,
                input: [
                    {
                        type: "user.message",
                        content: [
                            { type: "text", text: "analyze" },
                            { type: "file", name: "Untitled.py", data: fileData },
                        ],
                    },
                ],
                listEvents: eventsPage([
                    modelMessage({
                        id: "m-analyze",
                        threadId: ROOT_THREAD_ID,
                        content: "File analyzed.",
                    }),
                ]) as unknown as Turn["listEvents"],
            });

            const result = await convertTurnsToThreadMessages(mockSession([analyzeTurn]));

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0]).toMatchObject({
                id: "turn-analyze-user",
                role: "user",
                content: [{ type: "text", text: "analyze" }],
            });
            if (result.messages[0]?.role !== "user") {
                return;
            }
            expect(result.messages[0].attachments).toHaveLength(1);
            expect(result.messages[0].attachments[0]).toMatchObject({
                type: "file",
                name: "Untitled.py",
                contentType: "text/x-python",
                status: { type: "complete" },
                content: [
                    {
                        type: "file",
                        mimeType: "text/x-python",
                        filename: "Untitled.py",
                        data: fileData,
                    },
                ],
            });
        });

        it("nests sub-agents within a turn group and isolates the next user turn", async () => {
            const spawnTurn = mockTurn({
                id: "turn-spawn",
                createdAt,
                input: [{ type: "user.message", content: "spawn agent" }],
                listEvents: eventsPage([
                    modelMessage({
                        id: "root-spawn",
                        threadId: ROOT_THREAD_ID,
                        toolCalls: [
                            {
                                id: "spawn-1",
                                type: "function",
                                function: { name: "create_sub_agent", arguments: "{}" },
                                toolInfo: {
                                    type: "truefoundry-system",
                                    name: "create_sub_agent",
                                },
                            },
                        ],
                    }),
                    threadCreated({
                        id: "t-created",
                        threadId: "child-1",
                        title: "Research agent",
                        agentInfo: {
                            type: "dynamic",
                            name: "researcher",
                            input: "do research",
                        },
                        parent: { threadId: ROOT_THREAD_ID, toolCallId: "spawn-1" },
                    }),
                    modelMessage({
                        id: "child-msg-1",
                        threadId: "child-1",
                        content: "initial child work",
                    }),
                ]) as unknown as Turn["listEvents"],
            });
            const continuationTurn = mockTurn({
                id: "turn-continuation",
                createdAt,
                input: [
                    {
                        type: "user.tool_approval",
                        threadId: ROOT_THREAD_ID,
                        toolCallId: "spawn-1",
                        approval: { status: "allow" },
                    },
                ],
                listEvents: eventsPage([
                    modelMessage({
                        id: "child-msg-2",
                        threadId: "child-1",
                        content: "more child work",
                    }),
                ]) as unknown as Turn["listEvents"],
            });
            const nextUserTurn = mockTurn({
                id: "turn-next",
                createdAt,
                input: [{ type: "user.message", content: "thanks" }],
                listEvents: eventsPage([
                    modelMessage({
                        id: "m-thanks",
                        threadId: ROOT_THREAD_ID,
                        content: "You're welcome!",
                    }),
                ]) as unknown as Turn["listEvents"],
            });

            const result = await convertTurnsToThreadMessages(
                mockSession([nextUserTurn, continuationTurn, spawnTurn]),
            );

            expect(result.messages).toHaveLength(4);
            const groupAssistant = result.messages[1];
            expect(groupAssistant?.role).toBe("assistant");
            if (groupAssistant?.role !== "assistant") {
                return;
            }
            const spawnPart = groupAssistant.content.find(
                (part) => part.type === "tool-call",
            );
            expect(spawnPart?.type).toBe("tool-call");
            if (spawnPart?.type !== "tool-call") {
                return;
            }
            expect(spawnPart.artifact).toEqual({
                subAgents: [
                    {
                        threadId: "child-1",
                        title: "Research agent",
                        agentInfo: {
                            type: "dynamic",
                            name: "researcher",
                            input: "do research",
                        },
                    },
                ],
            });
            expect(spawnPart.messages?.[0]?.metadata.custom.subAgent).toEqual({
                threadId: "child-1",
                title: "Research agent",
                name: "researcher",
                input: "do research",
            });

            const nextAssistant = result.messages[3];
            expect(nextAssistant?.role).toBe("assistant");
            if (nextAssistant?.role !== "assistant") {
                return;
            }
            expect(nextAssistant.content).toEqual([
                { type: "text", text: "You're welcome!" },
            ]);
            expect(
                nextAssistant.content.some((part) => part.type === "tool-call"),
            ).toBe(false);
        });
    });

    describe("streamTurnEvents", () => {
        it("yields folded root content as model messages arrive", async () => {
            const foldState = new PeerThreadFoldState();
            const updates = await collectStream(
                streamTurnEvents(
                    streamFrom([
                        modelMessage({
                            id: "m1",
                            threadId: ROOT_THREAD_ID,
                            content: "streaming",
                        }),
                    ]),
                    foldState,
                ),
            );

            expect(updates).toEqual([{ content: [{ type: "text", text: "streaming" }] }]);
        });

        it("yields folded content after each ingested stream event", async () => {
            const foldState = new PeerThreadFoldState();
            const updates = await collectStream(
                streamTurnEvents(
                    streamFrom([
                        modelMessage({
                            id: "m1",
                            threadId: ROOT_THREAD_ID,
                            content: "first",
                        }),
                        modelMessage({
                            id: "m2",
                            threadId: ROOT_THREAD_ID,
                            content: "second",
                        }),
                        modelMessage({
                            id: "m3",
                            threadId: ROOT_THREAD_ID,
                            content: "third",
                        }),
                    ]),
                    foldState,
                ),
            );

            expect(updates).toHaveLength(3);
            expect(updates[0]?.content).toEqual([{ type: "text", text: "first" }]);
            expect(updates[1]?.content).toEqual([
                { type: "text", text: "first" },
                { type: "text", text: "second" },
            ]);
            expect(updates[2]?.content).toEqual([
                { type: "text", text: "first" },
                { type: "text", text: "second" },
                { type: "text", text: "third" },
            ]);
        });

        it("scopes streamed content to ids after the group baseline", async () => {
            const foldState = new PeerThreadFoldState();
            foldState.getOrCreateBucket(ROOT_THREAD_ID);
            foldState.threads.get(ROOT_THREAD_ID)!.modelMessageIds.push("prior");
            foldState.threads.get(ROOT_THREAD_ID)!.events.set(
                "prior",
                modelMessage({
                    id: "prior",
                    threadId: ROOT_THREAD_ID,
                    content: "old turn",
                }),
            );

            const updates = await collectStream(
                streamTurnEvents(
                    streamFrom([
                        modelMessage({
                            id: "m-new",
                            threadId: ROOT_THREAD_ID,
                            content: "new turn only",
                        }),
                    ]),
                    foldState,
                    ["prior"],
                ),
            );

            expect(updates).toEqual([
                { content: [{ type: "text", text: "new turn only" }] },
            ]);
        });

        it("throws when the turn ends in error", async () => {
            const foldState = new PeerThreadFoldState();
            await expect(
                collectStream(
                    streamTurnEvents(
                        streamFrom([
                            {
                                type: "turn.done",
                                id: "turn-done",
                                createdAt,
                                state: {
                                    status: "error",
                                    message: "boom",
                                    completedAt: createdAt,
                                },
                            },
                        ]),
                        foldState,
                    ),
                ),
            ).rejects.toThrow("boom");
        });

        it("emits tool approval metadata after the stream when approvals remain pending", async () => {
            const foldState = new PeerThreadFoldState();
            const updates = await collectStream(
                streamTurnEvents(
                    streamFrom([
                        modelMessage({
                            id: "m1",
                            threadId: ROOT_THREAD_ID,
                            content: "run tool",
                            toolCalls: [
                                {
                                    id: "approval-1",
                                    type: "function",
                                    function: { name: "bash", arguments: "{}" },
                                    toolInfo: {
                                        type: "mcp",
                                        name: "bash",
                                        serverId: "bash-server",
                                        serverName: "bash",
                                    },
                                },
                            ],
                        }),
                        approvalRequired({
                            id: "approval-event",
                            threadId: ROOT_THREAD_ID,
                            toolCalls: [{ id: "approval-1", sourceEventId: "m1" }],
                        }),
                    ]),
                    foldState,
                ),
            );

            const final = updates.at(-1);
            expect(final?.status).toEqual({
                type: "requires-action",
                reason: "tool-calls",
            });
            expect(final?.metadata?.custom?.[TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY]).toBe(
                ROOT_THREAD_ID,
            );
        });

        it("defers mcp auth until stream end and appends auth links", async () => {
            const foldState = new PeerThreadFoldState();
            const updates = await collectStream(
                streamTurnEvents(
                    streamFrom([
                        modelMessage({
                            id: "m1",
                            threadId: ROOT_THREAD_ID,
                            content: "before auth",
                        }),
                        {
                            type: "mcp.auth_required",
                            id: "mcp-auth",
                            createdAt,
                            mcpServers: [
                                {
                                    id: "github-auth",
                                    name: "github",
                                    authUrl: "https://example.com/auth",
                                },
                            ],
                        },
                    ]),
                    foldState,
                ),
            );

            expect(updates).toHaveLength(2);
            expect(updates[0]).toEqual({
                content: [{ type: "text", text: "before auth" }],
            });
            expect(updates[1]?.status).toEqual({
                type: "requires-action",
                reason: "interrupt",
            });
            expect(updates[1]?.content.at(-1)).toMatchObject({
                type: "text",
                text: expect.stringContaining("Authorize github"),
            });
        });

        it("stamps sandboxId onto every content yield after sandbox.created is seen", async () => {
            const foldState = new PeerThreadFoldState();
            const updates = await collectStream(
                streamTurnEvents(
                    streamFrom([
                        modelMessage({
                            id: "m1",
                            threadId: ROOT_THREAD_ID,
                            content: "before sandbox",
                        }),
                        sandboxCreated({ id: "sandbox-evt", sandboxId: "sbx-123" }),
                        modelMessage({
                            id: "m2",
                            threadId: ROOT_THREAD_ID,
                            content: "after sandbox",
                        }),
                    ]),
                    foldState,
                ),
            );

            expect(updates).toHaveLength(2);
            expect(updates[0]?.metadata?.custom?.sandboxId).toBeUndefined();
            expect(updates[1]?.metadata?.custom?.sandboxId).toBe("sbx-123");
        });

        it("yields a trailing update carrying sandboxId when sandbox.created is the last event", async () => {
            const foldState = new PeerThreadFoldState();
            const updates = await collectStream(
                streamTurnEvents(
                    streamFrom([
                        modelMessage({
                            id: "m1",
                            threadId: ROOT_THREAD_ID,
                            content: "some content",
                        }),
                        sandboxCreated({ id: "sandbox-evt", sandboxId: "sbx-123" }),
                    ]),
                    foldState,
                ),
            );

            const final = updates.at(-1);
            expect(final?.metadata?.custom?.sandboxId).toBe("sbx-123");
        });

        it("keeps sandboxId on the final mcp auth yield when both occur in the same stream", async () => {
            const foldState = new PeerThreadFoldState();
            const updates = await collectStream(
                streamTurnEvents(
                    streamFrom([
                        sandboxCreated({ id: "sandbox-evt", sandboxId: "sbx-123" }),
                        modelMessage({
                            id: "m1",
                            threadId: ROOT_THREAD_ID,
                            content: "before auth",
                        }),
                        {
                            type: "mcp.auth_required",
                            id: "mcp-auth",
                            createdAt,
                            mcpServers: [
                                {
                                    id: "github-auth",
                                    name: "github",
                                    authUrl: "https://example.com/auth",
                                },
                            ],
                        },
                    ]),
                    foldState,
                ),
            );

            const final = updates.at(-1);
            expect(final?.metadata?.custom?.sandboxId).toBe("sbx-123");
            expect(final?.status).toEqual({ type: "requires-action", reason: "interrupt" });
        });
    });

    describe("projectSessionMessages streamComplete", () => {
        const turnId = "turn-live";

        function snapshotWithCompletedStream(
            update: TurnStreamUpdate,
            foldState: PeerThreadFoldState,
        ) {
            return {
                ...replaceSessionSnapshot(createEmptySessionSnapshot(), {
                    pendingUser: {
                        turnId,
                        content: "hello",
                        createdAt: new Date(createdAt),
                    },
                    activeStream: {
                        turnId,
                        update,
                        isContinuation: false,
                        streamComplete: true,
                    },
                }),
                fold: foldState,
            };
        }

        it("keeps streamed images on the assistant message for text-only user prompts", () => {
            const imageDataUri = "data:image/jpeg;base64,/9j/4AAQ";
            const messages = projectSessionMessages(
                replaceSessionSnapshot(createEmptySessionSnapshot(), {
                    pendingUser: {
                        turnId,
                        content: "Create image of dog",
                        createdAt: new Date(createdAt),
                    },
                    activeStream: {
                        turnId,
                        update: {
                            content: [
                                {
                                    type: "image",
                                    image: imageDataUri,
                                    filename: "image-1.jpeg",
                                },
                            ],
                        },
                        isContinuation: false,
                        streamComplete: true,
                    },
                }),
            );

            expect(messages).toHaveLength(2);
            const user = messages[0];
            const assistant = messages[1];
            expect(user?.role).toBe("user");
            if (user?.role !== "user") {
                return;
            }
            expect(user.attachments).toEqual([]);
            expect(assistant?.role).toBe("assistant");
            if (assistant?.role !== "assistant") {
                return;
            }
            expect(assistant.content).toEqual([
                {
                    type: "image",
                    image: imageDataUri,
                    filename: "image-1.jpeg",
                },
            ]);
        });

        it("preserves requires-action when streamComplete and update has approval status", async () => {
            const foldState = new PeerThreadFoldState();
            const updates = await collectStream(
                streamTurnEvents(
                    streamFrom([
                        modelMessage({
                            id: "m1",
                            threadId: ROOT_THREAD_ID,
                            content: "run tool",
                            toolCalls: [
                                {
                                    id: "approval-1",
                                    type: "function",
                                    function: { name: "bash", arguments: "{}" },
                                    toolInfo: {
                                        type: "mcp",
                                        name: "bash",
                                        serverId: "bash-server",
                                        serverName: "bash",
                                    },
                                },
                            ],
                        }),
                        approvalRequired({
                            id: "approval-event",
                            threadId: ROOT_THREAD_ID,
                            toolCalls: [{ id: "approval-1", sourceEventId: "m1" }],
                        }),
                    ]),
                    foldState,
                ),
            );

            const finalUpdate = updates.at(-1)!;
            const messages = projectSessionMessages(
                snapshotWithCompletedStream(finalUpdate, foldState),
            );

            const assistant = messages.at(-1);
            expect(assistant?.role).toBe("assistant");
            if (assistant?.role !== "assistant") {
                return;
            }
            expect(assistant.status).toEqual({
                type: "requires-action",
                reason: "tool-calls",
            });
            expect(assistant.content.find((part) => part.type === "tool-call")).toMatchObject({
                type: "tool-call",
                toolCallId: "approval-1",
                approval: { id: "approval-1" },
            });
            expect(findPausedAssistantMessage(messages)).toBe(assistant);
        });

        it("preserves requires-action when streamComplete and update has ask-user status", async () => {
            const foldState = new PeerThreadFoldState();
            const updates = await collectStream(
                streamTurnEvents(
                    streamFrom([
                        modelMessage({
                            id: "model-1",
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
                                    toolInfo: {
                                        type: "truefoundry-system",
                                        name: "ask_user_question",
                                    },
                                },
                            ],
                        }),
                        responseRequired({
                            id: "resp-req-1",
                            threadId: ROOT_THREAD_ID,
                            toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
                        }),
                    ]),
                    foldState,
                ),
            );

            const finalUpdate = updates.at(-1)!;
            const messages = projectSessionMessages(
                snapshotWithCompletedStream(finalUpdate, foldState),
            );

            const assistant = messages.at(-1);
            expect(assistant?.role).toBe("assistant");
            if (assistant?.role !== "assistant") {
                return;
            }
            expect(assistant.status).toEqual({
                type: "requires-action",
                reason: "tool-calls",
            });
            expect(assistant.content[0]).toMatchObject({
                type: "tool-call",
                toolCallId: "question-1",
                interrupt: {
                    type: "human",
                    payload: { question: "Pick one", options: ["A", "B"] },
                },
            });
            expect(findPausedAssistantMessage(messages)).toBe(assistant);
        });

        it("forces complete when streamComplete and update has no explicit status", () => {
            const foldState = new PeerThreadFoldState();
            const messages = projectSessionMessages(
                snapshotWithCompletedStream(
                    { content: [{ type: "text", text: "done" }] },
                    foldState,
                ),
            );

            const assistant = messages.at(-1);
            expect(assistant?.role).toBe("assistant");
            if (assistant?.role !== "assistant") {
                return;
            }
            expect(assistant.status).toEqual({
                type: "complete",
                reason: "stop",
            });
        });
    });

    describe("ask-user reload projection", () => {
        it("does not resurface answered ask-user prompts after a continuation turn", () => {
            const fold = new PeerThreadFoldState();
            const turn1Id = "turn-1";
            const turn2Id = "turn-2";

            ingestTurnEvent(
                fold,
                modelMessage({
                    id: "model-1",
                    threadId: ROOT_THREAD_ID,
                    toolCalls: [
                        {
                            id: "question-1",
                            type: "function",
                            function: {
                                name: "ask_user_question",
                                arguments: JSON.stringify({
                                    question: "What would you like help with today?",
                                    options: ["Help with a coding or technical task"],
                                }),
                            },
                            toolInfo: {
                                type: "truefoundry-system",
                                name: "ask_user_question",
                            },
                        },
                    ],
                }),
            );
            ingestTurnEvent(
                fold,
                responseRequired({
                    id: "resp-req-1",
                    threadId: ROOT_THREAD_ID,
                    toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
                }),
            );
            applyUserToolResponsesToFold(fold, []);

            ingestTurnEvent(
                fold,
                modelMessage({
                    id: "model-2",
                    threadId: ROOT_THREAD_ID,
                    content: "Great, you'd like help with a coding task!",
                }),
            );
            applyUserToolResponsesToFold(fold, [
                {
                    type: "user.tool_response",
                    threadId: ROOT_THREAD_ID,
                    toolCallId: "question-1",
                    content: "Help with a coding or technical task",
                },
            ]);

            const snapshot = replaceSessionSnapshot(createEmptySessionSnapshot(), {
                fold,
                turns: [
                    {
                        id: turn1Id,
                        createdAt,
                        userText: "hello",
                        state: {
                            status: "done",
                            requiredActions: [],
                            completedAt: createdAt,
                        },
                        input: [{ type: "user.message", content: "hello" }],
                        rootModelMessageIds: ["model-1"],
                    },
                    {
                        id: turn2Id,
                        createdAt,
                        state: {
                            status: "done",
                            requiredActions: [],
                            completedAt: createdAt,
                        },
                        input: [
                            {
                                type: "user.tool_response",
                                threadId: ROOT_THREAD_ID,
                                toolCallId: "question-1",
                                content: "Help with a coding or technical task",
                            },
                        ],
                        rootModelMessageIds: ["model-2"],
                    },
                ],
            });

            const messages = projectSessionMessages(snapshot);
            expect(collectPendingToolResponses(messages)).toHaveLength(0);

            const assistant = messages.find((message) => message.role === "assistant");
            expect(assistant).toBeDefined();
            const toolCall = assistant?.content.find((part) => part.type === "tool-call");
            expect(toolCall).toMatchObject({
                type: "tool-call",
                toolCallId: "question-1",
                result: "Help with a coding or technical task",
            });
            if (toolCall?.type === "tool-call") {
                expect(toolCall.interrupt).toBeUndefined();
            }
        });

        it("keeps a committed ask-user pause as requires-action so it can be resumed", () => {
            // Reproduces the live-stream pause path: once the SSE stream ends,
            // `commitActiveStream` moves the paused turn into `turns` with a
            // fabricated `TurnStateDone`. The pause must survive as a
            // `tool.response_required` required action, otherwise the projected
            // assistant message is not `requires-action` and
            // `findPausedAssistantMessage` (the gate that fires the resume turn)
            // never sees it.
            const fold = new PeerThreadFoldState();
            const turnId = "turn-ask";

            ingestTurnEvent(
                fold,
                modelMessage({
                    id: "model-1",
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
                            toolInfo: {
                                type: "truefoundry-system",
                                name: "ask_user_question",
                            },
                        },
                    ],
                }),
            );
            ingestTurnEvent(
                fold,
                responseRequired({
                    id: "resp-req-1",
                    threadId: ROOT_THREAD_ID,
                    toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
                }),
            );

            const snapshot = replaceSessionSnapshot(createEmptySessionSnapshot(), {
                fold,
                turns: [
                    {
                        id: turnId,
                        createdAt,
                        userText: "ask me a question",
                        state: {
                            status: "done",
                            requiredActions: [
                                responseRequired({
                                    id: "resp-req-1",
                                    threadId: ROOT_THREAD_ID,
                                    toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
                                }),
                            ],
                            completedAt: createdAt,
                        },
                        input: [{ type: "user.message", content: "ask me a question" }],
                        rootModelMessageIds: ["model-1"],
                    },
                ],
            });

            const messages = projectSessionMessages(snapshot);
            const paused = findPausedAssistantMessage(messages);
            expect(paused).toBeDefined();
            expect(paused?.status).toMatchObject({ type: "requires-action" });
        });

        it("rebuilds paused activeStream content from fold after an ask-user answer is recorded", () => {
            const fold = new PeerThreadFoldState();
            const turnId = "turn-ask";

            ingestTurnEvent(
                fold,
                modelMessage({
                    id: "model-1",
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
                            toolInfo: {
                                type: "truefoundry-system",
                                name: "ask_user_question",
                            },
                        },
                    ],
                }),
            );
            ingestTurnEvent(
                fold,
                responseRequired({
                    id: "resp-req-1",
                    threadId: ROOT_THREAD_ID,
                    toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
                }),
            );

            const pausedContent = buildRootAssistantContent(fold);
            applyUserToolResponsesToFold(fold, [
                {
                    type: "user.tool_response",
                    threadId: ROOT_THREAD_ID,
                    toolCallId: "question-1",
                    content: "A",
                },
            ]);

            const snapshot = replaceSessionSnapshot(createEmptySessionSnapshot(), {
                fold,
                pendingUser: {
                    turnId,
                    content: "ask me a question",
                    createdAt: new Date(createdAt),
                },
                activeStream: {
                    turnId,
                    isContinuation: false,
                    streamComplete: true,
                    update: {
                        content: pausedContent,
                        status: toolResponseStatus(),
                    },
                },
                groupRootBaseline: [],
            });

            const messages = projectSessionMessages(snapshot);
            expect(collectPendingToolResponses(messages)).toHaveLength(0);
        });
    });

    describe("ask-user live continuation projection", () => {
        it("scopes activeStream to the current group when a continuation turn completes", () => {
            const fold = new PeerThreadFoldState();

            ingestTurnEvent(
                fold,
                modelMessage({
                    id: "model-1",
                    threadId: ROOT_THREAD_ID,
                    toolCalls: [
                        {
                            id: "question-1",
                            type: "function",
                            function: {
                                name: "ask_user_question",
                                arguments: JSON.stringify({
                                    question: "What would you like help with?",
                                    options: ["Help with a coding task"],
                                }),
                            },
                            toolInfo: {
                                type: "truefoundry-system",
                                name: "ask_user_question",
                            },
                        },
                    ],
                }),
            );
            ingestTurnEvent(
                fold,
                responseRequired({
                    id: "resp-req-1",
                    threadId: ROOT_THREAD_ID,
                    toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
                }),
            );
            applyUserToolResponsesToFold(fold, [
                {
                    type: "user.tool_response",
                    threadId: ROOT_THREAD_ID,
                    toolCallId: "question-1",
                    content: "Help with a coding task",
                },
            ]);
            ingestTurnEvent(
                fold,
                modelMessage({
                    id: "model-2",
                    threadId: ROOT_THREAD_ID,
                    content: "Group 1 follow-up",
                }),
            );

            ingestTurnEvent(
                fold,
                modelMessage({
                    id: "model-3",
                    threadId: ROOT_THREAD_ID,
                    toolCalls: [
                        {
                            id: "question-2",
                            type: "function",
                            function: {
                                name: "ask_user_question",
                                arguments: JSON.stringify({
                                    question: "What kind of code?",
                                    options: ["Write new code"],
                                }),
                            },
                            toolInfo: {
                                type: "truefoundry-system",
                                name: "ask_user_question",
                            },
                        },
                    ],
                }),
            );
            ingestTurnEvent(
                fold,
                responseRequired({
                    id: "resp-req-2",
                    threadId: ROOT_THREAD_ID,
                    toolCalls: [{ id: "question-2", sourceEventId: "model-3" }],
                }),
            );
            applyUserToolResponsesToFold(fold, [
                {
                    type: "user.tool_response",
                    threadId: ROOT_THREAD_ID,
                    toolCallId: "question-2",
                    content: "Write new code",
                },
            ]);
            ingestTurnEvent(
                fold,
                modelMessage({
                    id: "model-4",
                    threadId: ROOT_THREAD_ID,
                    content: "Group 2 follow-up",
                }),
            );

            const snapshot = replaceSessionSnapshot(createEmptySessionSnapshot(), {
                fold,
                groupRootBaseline: ["model-1", "model-2"],
                turns: [
                    {
                        id: "turn-1",
                        createdAt,
                        userText: "ask me a question",
                        state: {
                            status: "done",
                            requiredActions: [],
                            completedAt: createdAt,
                        },
                        input: [{ type: "user.message", content: "ask me a question" }],
                        rootModelMessageIds: ["model-1"],
                    },
                    {
                        id: "turn-2",
                        createdAt,
                        state: {
                            status: "done",
                            requiredActions: [],
                            completedAt: createdAt,
                        },
                        input: [
                            {
                                type: "user.tool_response",
                                threadId: ROOT_THREAD_ID,
                                toolCallId: "question-1",
                                content: "Help with a coding task",
                            },
                        ],
                        rootModelMessageIds: ["model-2"],
                    },
                    {
                        id: "turn-3",
                        createdAt,
                        userText: "ask again",
                        state: {
                            status: "done",
                            requiredActions: [],
                            completedAt: createdAt,
                        },
                        input: [{ type: "user.message", content: "ask again" }],
                        rootModelMessageIds: ["model-3"],
                    },
                ],
                activeStream: {
                    turnId: "turn-4",
                    isContinuation: true,
                    streamComplete: true,
                    update: {
                        content: [{ type: "text", text: "Group 2 follow-up" }],
                        status: { type: "complete", reason: "stop" },
                    },
                },
            });

            const messages = projectSessionMessages(snapshot);
            expect(messages).toHaveLength(4);

            const group1Assistant = messages[1];
            const group2Assistant = messages[3];
            expect(group1Assistant?.role).toBe("assistant");
            expect(group2Assistant?.role).toBe("assistant");
            if (group1Assistant?.role !== "assistant" || group2Assistant?.role !== "assistant") {
                return;
            }

            const group1Texts = group1Assistant.content
                .filter((part) => part.type === "text")
                .map((part) => part.text);
            const group2Texts = group2Assistant.content
                .filter((part) => part.type === "text")
                .map((part) => part.text);

            expect(group1Texts).toContain("Group 1 follow-up");
            expect(group1Texts).not.toContain("Group 2 follow-up");
            expect(group2Texts).toContain("Group 2 follow-up");
            expect(group2Texts).not.toContain("Group 1 follow-up");

            const group2ToolCalls = group2Assistant.content.filter(
                (part) => part.type === "tool-call",
            );
            expect(group2ToolCalls).toHaveLength(1);
            expect(group2ToolCalls[0]).toMatchObject({
                toolCallId: "question-2",
                result: "Write new code",
            });
        });
    });
});

// ---------------------------------------------------------------------------
// buildSnapshotFromSessionEvents
// ---------------------------------------------------------------------------

type SessionEventItem = { turnId: string; event: TurnCreatedEvent | TurnDoneEvent | TurnEvent };

/** Simulates session.listEvents — returns items in desc order (newest first). */
function sessionEventsPage(
    items: SessionEventItem[],
    options?: { pageSize?: number },
) {
    return async (opts?: {
        lastTurnId?: string;
        pageToken?: string;
        limit?: number;
    }) => {
        let filtered = items;
        if (opts?.lastTurnId != null) {
            // Chronological items: keep through lastTurnId, drop later turns.
            const lastIndex = filtered.findLastIndex(
                (item) => item.turnId === opts.lastTurnId,
            );
            filtered = lastIndex === -1 ? [] : filtered.slice(0, lastIndex + 1);
        }
        const newestFirst = [...filtered].reverse();
        // Prefer fixture pageSize so pagination tests are not forced to the API default limit.
        const pageSize =
            options?.pageSize ?? opts?.limit ?? (newestFirst.length || 1);
        const pageIndex = opts?.pageToken != null ? Number(opts.pageToken) : 0;
        const start = pageIndex * pageSize;
        const slice = newestFirst.slice(start, start + pageSize);
        const hasMore = start + pageSize < newestFirst.length;
        const nextPageToken = hasMore ? String(pageIndex + 1) : undefined;
        return {
            data: slice,
            response: {
                data: slice,
                pagination: {
                    limit: pageSize,
                    ...(nextPageToken != null ? { nextPageToken } : {}),
                },
            },
            hasNextPage: () => hasMore,
            async *[Symbol.asyncIterator]() {
                // Full drain for rewind paths that still iterate all pages.
                for (const item of newestFirst) {
                    yield item;
                }
            },
        };
    };
}

/** Builds a mock AgentSession with listTurns and listEvents. */
function mockSessionWithEvents(
    turns: Turn[],
    eventItems: SessionEventItem[],
): AgentSession {
    return {
        listTurns: turnsPage(turns),
        listEvents: sessionEventsPage(eventItems),
    } as unknown as AgentSession;
}

describe("buildSnapshotFromSessionEvents", () => {
    it("builds a snapshot from a single complete turn", async () => {
        const items: SessionEventItem[] = [
            {
                turnId: "t1",
                event: {
                    type: "turn.created",
                    id: "evt-c1",
                    turnId: "t1",
                    input: [{ type: "user.message", content: "hello" }],
                    state: { status: "running" },
                    createdBy: { subjectId: "u1", subjectType: "user" },
                    createdAt,
                },
            },
            {
                turnId: "t1",
                event: modelMessage({ id: "m1", threadId: ROOT_THREAD_ID, content: "hi there" }),
            },
            {
                turnId: "t1",
                event: {
                    type: "turn.done",
                    id: "evt-d1",
                    state: { status: "done", requiredActions: [], completedAt: createdAt },
                    createdAt,
                } as TurnDoneEvent,
            },
        ];

        const snapshot = await buildSnapshotFromSessionEvents(mockSessionWithEvents([], items));

        expect(snapshot.turns).toHaveLength(1);
        expect(snapshot.turns[0]?.id).toBe("t1");
        expect(snapshot.turns[0]?.userText).toBe("hello");
        expect(snapshot.turns[0]?.state).toEqual({
            status: "done",
            requiredActions: [],
            completedAt: createdAt,
        });
        expect(snapshot.turns[0]?.rootModelMessageIds).toEqual(["m1"]);
        expect(snapshot.runningTurn).toBeUndefined();

        const messages = projectSessionMessages(snapshot);
        expect(messages).toHaveLength(2);
        expect(messages[0]?.role).toBe("user");
        expect(messages[1]?.role).toBe("assistant");
    });

    it("detects and attaches the running turn without events", async () => {
        const runningTurn = {
            id: "t2",
            state: { status: "running" },
            input: [{ type: "user.message", content: "in progress" }],
            createdAt,
        } as unknown as Turn;

        const items: SessionEventItem[] = [
            {
                turnId: "t1",
                event: {
                    type: "turn.created",
                    id: "evt-c1",
                    turnId: "t1",
                    input: [{ type: "user.message", content: "first" }],
                    state: { status: "running" },
                    createdBy: { subjectId: "u1", subjectType: "user" },
                    createdAt,
                },
            },
            {
                turnId: "t1",
                event: modelMessage({ id: "m1", threadId: ROOT_THREAD_ID, content: "reply 1" }),
            },
            {
                turnId: "t1",
                event: {
                    type: "turn.done",
                    id: "evt-d1",
                    state: { status: "done", requiredActions: [], completedAt: createdAt },
                    createdAt,
                } as TurnDoneEvent,
            },
            // t2 (running) has no events — it is excluded from session-level listEvents
        ];

        const snapshot = await buildSnapshotFromSessionEvents(
            mockSessionWithEvents([runningTurn], items),
        );

        expect(snapshot.turns).toHaveLength(1);
        expect(snapshot.turns[0]?.id).toBe("t1");
        expect(snapshot.runningTurn).toBe(runningTurn);
        expect(snapshot.unstable_resume).toBe(true);
        expect(snapshot.groupRootBaseline).toBeDefined();
        expect(snapshot.pendingUser).toMatchObject({
            turnId: "t2",
            content: "in progress",
        });
    });

    it("calls onProgress after each completed turn", async () => {
        const items: SessionEventItem[] = [
            {
                turnId: "t1",
                event: {
                    type: "turn.created",
                    id: "evt-c1",
                    turnId: "t1",
                    input: [{ type: "user.message", content: "first" }],
                    state: { status: "running" },
                    createdBy: { subjectId: "u1", subjectType: "user" },
                    createdAt,
                },
            },
            {
                turnId: "t1",
                event: modelMessage({ id: "m1", threadId: ROOT_THREAD_ID, content: "reply 1" }),
            },
            {
                turnId: "t1",
                event: {
                    type: "turn.done",
                    id: "evt-d1",
                    state: { status: "done", requiredActions: [], completedAt: createdAt },
                    createdAt,
                } as TurnDoneEvent,
            },
            {
                turnId: "t2",
                event: {
                    type: "turn.created",
                    id: "evt-c2",
                    turnId: "t2",
                    input: [{ type: "user.message", content: "second" }],
                    state: { status: "running" },
                    createdBy: { subjectId: "u1", subjectType: "user" },
                    createdAt,
                },
            },
            {
                turnId: "t2",
                event: modelMessage({ id: "m2", threadId: ROOT_THREAD_ID, content: "reply 2" }),
            },
            {
                turnId: "t2",
                event: {
                    type: "turn.done",
                    id: "evt-d2",
                    state: { status: "done", requiredActions: [], completedAt: createdAt },
                    createdAt,
                } as TurnDoneEvent,
            },
        ];

        const progressSnapshots: number[] = [];
        await buildSnapshotFromSessionEvents(
            mockSessionWithEvents([], items),
            (snap) => progressSnapshots.push(snap.turns.length),
        );

        expect(progressSnapshots).toEqual([1, 2]);
    });

    it("only inspects the newest listTurns page for a running turn", async () => {
        const listTurns = vi.fn(async () => ({
            data: [
                {
                    id: "t-running",
                    state: { status: "running" },
                    input: [{ type: "user.message", content: "now" }],
                    createdAt,
                },
            ],
            response: { data: [], pagination: { limit: 1, nextPageToken: "more" } },
            hasNextPage: () => true,
            getNextPage: async () => {
                throw new Error("listTurns must not paginate on initial load");
            },
            async *[Symbol.asyncIterator]() {
                throw new Error("listTurns must not be fully iterated on initial load");
            },
        }));

        const session = {
            listTurns,
            listEvents: sessionEventsPage([]),
        } as unknown as AgentSession;

        const snapshot = await buildSnapshotFromSessionEvents(session);
        expect(listTurns).toHaveBeenCalledWith({ limit: 1 });
        expect(snapshot.runningTurn?.id).toBe("t-running");
        expect(snapshot.pendingUser?.content).toBe("now");
    });

    it("loads only the newest event page and exposes an older-history cursor", async () => {
        const makeTurnItems = (id: string, text: string): SessionEventItem[] => [
            {
                turnId: id,
                event: {
                    type: "turn.created",
                    id: `evt-c-${id}`,
                    turnId: id,
                    input: [{ type: "user.message", content: text }],
                    state: { status: "running" },
                    createdBy: { subjectId: "u1", subjectType: "user" },
                    createdAt,
                },
            },
            {
                turnId: id,
                event: modelMessage({
                    id: `m-${id}`,
                    threadId: ROOT_THREAD_ID,
                    content: `reply ${text}`,
                }),
            },
            {
                turnId: id,
                event: {
                    type: "turn.done",
                    id: `evt-d-${id}`,
                    state: { status: "done", requiredActions: [], completedAt: createdAt },
                    createdAt,
                } as TurnDoneEvent,
            },
        ];

        // 3 events per turn; pageSize 3 → one turn per page (newest first).
        const items = [
            ...makeTurnItems("t1", "first"),
            ...makeTurnItems("t2", "second"),
            ...makeTurnItems("t3", "third"),
        ];
        const listEvents = sessionEventsPage(items, { pageSize: 3 });
        const listEventsSpy = vi.fn(listEvents);
        const session = {
            listTurns: turnsPage([]),
            listEvents: listEventsSpy,
        } as unknown as AgentSession;

        const snapshot = await buildSnapshotFromSessionEvents(session);
        expect(listEventsSpy).toHaveBeenCalledTimes(1);
        expect(snapshot.turns.map((t) => t.id)).toEqual(["t3"]);
        expect(snapshot.historyPagination).toEqual({
            hasOlder: true,
            olderPageToken: "1",
        });

        const withOlder = await prependOlderSessionHistory(session, snapshot);
        expect(withOlder.turns.map((t) => t.id)).toEqual(["t2", "t3"]);
        expect(projectSessionMessages(withOlder).map((m) => m.role)).toEqual([
            "user",
            "assistant",
            "user",
            "assistant",
        ]);
        expect(withOlder.historyPagination?.hasOlder).toBe(true);

        const withAll = await prependOlderSessionHistory(session, withOlder);
        expect(withAll.turns.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
        expect(withAll.historyPagination?.hasOlder).toBe(false);
    });
});

describe("buildSnapshotBeforeTurnIndex", () => {
    it("rewinds via session.listEvents({ lastTurnId }) excluding the branch turn", async () => {
        const t1 = mockTurn({
            id: "t1",
            createdAt,
            input: [{ type: "user.message", content: "first" }],
            listEvents: eventsPage([
                modelMessage({ id: "m1", threadId: ROOT_THREAD_ID, content: "reply 1" }),
            ]) as unknown as Turn["listEvents"],
        });
        const t2 = mockTurn({
            id: "t2",
            createdAt,
            input: [{ type: "user.message", content: "second" }],
            listEvents: eventsPage([
                modelMessage({ id: "m2", threadId: ROOT_THREAD_ID, content: "reply 2" }),
            ]) as unknown as Turn["listEvents"],
        });
        const t3 = mockTurn({
            id: "t3",
            createdAt,
            input: [{ type: "user.message", content: "third" }],
            listEvents: eventsPage([
                modelMessage({ id: "m3", threadId: ROOT_THREAD_ID, content: "reply 3" }),
            ]) as unknown as Turn["listEvents"],
        });

        // listTurns is newest-first.
        const session = mockSession([t3, t2, t1]);
        const snapshot = await buildSnapshotBeforeTurnIndex(session, 2);

        expect(snapshot.turns.map((turn) => turn.id)).toEqual(["t1", "t2"]);
        const messages = projectSessionMessages(snapshot);
        expect(messages.map((message) => message.id)).toEqual([
            "t1-user",
            "t1-assistant",
            "t2-user",
            "t2-assistant",
        ]);
    });

    it("returns an empty snapshot when branching from the first turn", async () => {
        const session = mockSession([
            mockTurn({ id: "t1", createdAt }),
        ]);
        const snapshot = await buildSnapshotBeforeTurnIndex(session, 0);
        expect(snapshot.turns).toHaveLength(0);
    });
});

