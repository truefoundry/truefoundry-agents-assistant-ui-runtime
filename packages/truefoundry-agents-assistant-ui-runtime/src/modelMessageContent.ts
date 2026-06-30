import type { ThreadAssistantMessagePart } from "@assistant-ui/core";
import type { ModelMessageEvent } from "truefoundry-gateway-sdk/agents";

import { parseAskUserQuestionArgs } from "./askUserQuestion.js";
import type { PendingResponseRef } from "./foldPeerThreads.js";

export type AssistantContentPart = ThreadAssistantMessagePart;

export type ToolCallContext = {
    toolResults?: ReadonlyMap<string, string>;
    pendingApprovals?: ReadonlyMap<string, { id: string }>;
    pendingResponses?: ReadonlyMap<string, PendingResponseRef>;
};

export type SdkToolCall = NonNullable<ModelMessageEvent["toolCalls"]>[number];

function parseToolArgs(argsText: string): Record<string, string | number | boolean | null> {
    if (!argsText) {
        return {};
    }
    try {
        const parsed: unknown = JSON.parse(argsText);
        if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, string | number | boolean | null>;
        }
        return {};
    } catch {
        return {};
    }
}

function toolCallToPart(
    toolCall: SdkToolCall,
    context?: ToolCallContext,
): Extract<AssistantContentPart, { type: "tool-call" }> {
    const argsText = toolCall.function.arguments ?? "";
    const result = context?.toolResults?.get(toolCall.id);
    const approval = context?.pendingApprovals?.get(toolCall.id);
    const pendingResponse = context?.pendingResponses?.get(toolCall.id);

    let interrupt: Extract<AssistantContentPart, { type: "tool-call" }>["interrupt"];
    if (pendingResponse != null && result === undefined) {
        interrupt = {
            type: "human",
            payload: {
                ...(pendingResponse.question != null
                    ? { question: pendingResponse.question }
                    : {}),
                ...(pendingResponse.options != null
                    ? { options: pendingResponse.options }
                    : {}),
            },
        };
    }

    return {
        type: "tool-call",
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        argsText,
        args: parseToolArgs(argsText),
        ...(result !== undefined ? { result } : {}),
        ...(approval != null ? { approval: { id: approval.id } } : {}),
        ...(interrupt != null ? { interrupt } : {}),
    };
}

function extractText(message: ModelMessageEvent): string {
    const { content, refusal } = message;
    if (content == null) {
        return refusal ?? "";
    }
    if (typeof content === "string") {
        return content;
    }
    return content
        .map((part) => {
            if (part.type === "text") {
                return part.text;
            }
            if (part.type === "refusal") {
                return part.refusal;
            }
            return "";
        })
        .join("");
}

export function buildAssistantContent(
    message: ModelMessageEvent,
    context?: ToolCallContext,
): AssistantContentPart[] {
    const parts: AssistantContentPart[] = [];
    if (message.reasoningContent) {
        parts.push({ type: "reasoning", text: message.reasoningContent });
    }
    const text = extractText(message);
    if (text) {
        parts.push({ type: "text", text });
    }
    for (const toolCall of message.toolCalls ?? []) {
        parts.push(toolCallToPart(toolCall, context));
    }
    return parts;
}
