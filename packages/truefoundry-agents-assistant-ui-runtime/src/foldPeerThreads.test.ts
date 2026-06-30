import { describe, expect, it } from "vitest";
import type {
    ModelMessageEvent,
    ThreadCreatedEvent,
    TurnEvent,
} from "truefoundry-gateway-sdk/agents";

import { ROOT_THREAD_ID } from "./constants.js";
import {
    buildRootAssistantContent,
    ingestStreamEvent,
    ingestTurnEvent,
    PeerThreadFoldState,
    recordToolResponseInFold,
} from "./foldPeerThreads.js";

const createdAt = new Date().toISOString();

function modelMessage(
    event: Omit<ModelMessageEvent, "type" | "createdAt">,
): ModelMessageEvent {
    return { type: "model.message", createdAt, ...event };
}

function threadCreated(
    event: Omit<ThreadCreatedEvent, "type" | "createdAt">,
): ThreadCreatedEvent {
    return { type: "thread.created", createdAt, ...event };
}

describe("foldPeerThreads", () => {
    it("anchors root content on main without inference", () => {
        const state = new PeerThreadFoldState();

        const rootMessage: TurnEvent = modelMessage({
            id: "m1",
            threadId: ROOT_THREAD_ID,
            content: "hello",
        });

        ingestTurnEvent(state, rootMessage);

        expect(buildRootAssistantContent(state)).toEqual([
            { type: "text", text: "hello" },
        ]);
    });

    it("captures sub-agent title from thread.created and tags nested messages", () => {
        const state = new PeerThreadFoldState();

        ingestTurnEvent(
            state,
            modelMessage({
                id: "root-msg",
                threadId: ROOT_THREAD_ID,
                toolCalls: [
                    {
                        id: "spawn-1",
                        type: "function",
                        function: { name: "create_sub_agent", arguments: "{}" },
                        toolInfo: { type: "truefoundry-system", name: "create_sub_agent" },
                    },
                ],
            }),
        );

        ingestTurnEvent(
            state,
            threadCreated({
                id: "t-created",
                threadId: "child-1",
                title: "Research agent",
                agentInfo: { type: "dynamic", name: "researcher", input: "do research" },
                parent: { threadId: ROOT_THREAD_ID, toolCallId: "spawn-1" },
            }),
        );

        ingestTurnEvent(
            state,
            modelMessage({
                id: "child-msg",
                threadId: "child-1",
                content: "working",
            }),
        );

        const parts = buildRootAssistantContent(state);
        const spawn = parts.find((part) => part.type === "tool-call");
        expect(spawn?.type).toBe("tool-call");
        if (spawn?.type !== "tool-call") {
            return;
        }

        expect(spawn.artifact).toEqual({
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

        const nested = spawn.messages?.[0];
        expect(nested?.metadata.custom.subAgent).toEqual({
            threadId: "child-1",
            title: "Research agent",
            name: "researcher",
            input: "do research",
        });
    });

    it("classifies stream events by thread id", () => {
        const state = new PeerThreadFoldState();
        expect(
            ingestStreamEvent(
                state,
                threadCreated({
                    id: "e1",
                    threadId: "child-1",
                    title: "Child",
                    agentInfo: { type: "dynamic", name: "child", input: "x" },
                    parent: { threadId: ROOT_THREAD_ID, toolCallId: "tc" },
                }),
            ),
        ).toBe(true);
        expect(state.threads.get("child-1")?.title).toBe("Child");
    });

    it("ingests tool.response_required and marks tool calls as pending responses", () => {
        const state = new PeerThreadFoldState();

        ingestTurnEvent(
            state,
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
                        toolInfo: { type: "truefoundry-system", name: "ask_user_question" },
                    },
                ],
            }),
        );

        ingestTurnEvent(state, {
            type: "tool.response_required",
            id: "resp-req-1",
            createdAt,
            threadId: ROOT_THREAD_ID,
            toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
        });

        const bucket = state.threads.get(ROOT_THREAD_ID)!;
        expect(bucket.pendingResponses.get("question-1")).toMatchObject({
            id: "question-1",
            sourceEventId: "model-1",
            question: "Pick one",
            options: ["A", "B"],
        });

        const parts = buildRootAssistantContent(state);
        const toolCall = parts.find((part) => part.type === "tool-call");
        expect(toolCall?.type).toBe("tool-call");
        if (toolCall?.type !== "tool-call") {
            return;
        }
        expect(toolCall.interrupt).toEqual({
            type: "human",
            payload: { question: "Pick one", options: ["A", "B"] },
        });
    });

    it("recordToolResponseInFold clears pending and attaches result", () => {
        const state = new PeerThreadFoldState();

        ingestTurnEvent(
            state,
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
                        toolInfo: { type: "truefoundry-system", name: "ask_user_question" },
                    },
                ],
            }),
        );

        ingestTurnEvent(state, {
            type: "tool.response_required",
            id: "resp-req-1",
            createdAt,
            threadId: ROOT_THREAD_ID,
            toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
        });

        recordToolResponseInFold(state, {
            toolCallId: "question-1",
            content: "A",
        });

        const bucket = state.threads.get(ROOT_THREAD_ID)!;
        expect(bucket.pendingResponses.has("question-1")).toBe(false);
        expect(bucket.toolResults.get("question-1")).toBe("A");

        const toolCall = buildRootAssistantContent(state).find(
            (part) => part.type === "tool-call",
        );
        expect(toolCall?.type).toBe("tool-call");
        if (toolCall?.type !== "tool-call") {
            return;
        }
        expect(toolCall.result).toBe("A");
        expect(toolCall.interrupt).toBeUndefined();
    });

    it("ingests tool.response and clears pending ask-user state", () => {
        const state = new PeerThreadFoldState();

        ingestTurnEvent(
            state,
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
                        toolInfo: { type: "truefoundry-system", name: "ask_user_question" },
                    },
                ],
            }),
        );

        ingestTurnEvent(state, {
            type: "tool.response_required",
            id: "resp-req-1",
            createdAt,
            threadId: ROOT_THREAD_ID,
            toolCalls: [{ id: "question-1", sourceEventId: "model-1" }],
        });

        ingestTurnEvent(state, {
            type: "tool.response",
            id: "resp-1",
            createdAt,
            threadId: ROOT_THREAD_ID,
            toolCallId: "question-1",
            content: "A",
        });

        const bucket = state.threads.get(ROOT_THREAD_ID)!;
        expect(bucket.pendingResponses.has("question-1")).toBe(false);
        expect(bucket.toolResults.get("question-1")).toBe("A");

        const toolCall = buildRootAssistantContent(state).find(
            (part) => part.type === "tool-call",
        );
        expect(toolCall?.type).toBe("tool-call");
        if (toolCall?.type !== "tool-call") {
            return;
        }
        expect(toolCall.result).toBe("A");
        expect(toolCall.interrupt).toBeUndefined();
    });
});
