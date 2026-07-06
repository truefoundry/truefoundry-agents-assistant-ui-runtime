import type { ThreadAssistantMessagePart } from "@assistant-ui/core";
import type { ModelMessageEvent } from "truefoundry-gateway-sdk/agents";
import type { PendingResponseRef } from "./foldPeerThreads.js";
import { extractImagePartsFromModelMessage } from "./modelMessageImageContent.js";

export type AssistantContentPart = ThreadAssistantMessagePart;

export type ToolCallContext = {
    toolResults?: ReadonlyMap<string, string>;
    pendingApprovals?: ReadonlyMap<string, { id: string }>;
    approvalDecisions?: ReadonlyMap<
        string,
        { id: string; approved: boolean; reason?: string }
    >;
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

type ToolCallPart = Extract<AssistantContentPart, { type: "tool-call" }>;

function toolCallToPart(
    toolCall: SdkToolCall,
    context?: ToolCallContext,
): ToolCallPart {
    const argsText = toolCall.function.arguments ?? "";
    const toolResult = context?.toolResults?.get(toolCall.id);
    const pendingResponse = context?.pendingResponses?.get(toolCall.id);
    const pendingApproval = context?.pendingApprovals?.get(toolCall.id);
    const approvalDecision = context?.approvalDecisions?.get(toolCall.id);

    let interrupt: ToolCallPart["interrupt"];
    if (pendingResponse != null && toolResult === undefined) {
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

    let approval: ToolCallPart["approval"];
    if (approvalDecision != null) {
        approval = {
            id: approvalDecision.id,
            approved: approvalDecision.approved,
            ...(approvalDecision.reason != null
                ? { reason: approvalDecision.reason }
                : {}),
        };
    } else if (pendingApproval != null) {
        approval = { id: pendingApproval.id };
    }

    let result: ToolCallPart["result"];
    let isError = false;
    if (toolResult !== undefined) {
        result = toolResult;
    } else if (approvalDecision?.approved === false) {
        result = { error: approvalDecision.reason || "Tool approval denied" };
        isError = true;
    }

    return {
        type: "tool-call",
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        argsText,
        args: parseToolArgs(argsText),
        ...(result !== undefined ? { result } : {}),
        ...(isError ? { isError: true } : {}),
        ...(approval != null ? { approval } : {}),
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
    parts.push(...extractImagePartsFromModelMessage(message));
    for (const toolCall of message.toolCalls ?? []) {
        parts.push(toolCallToPart(toolCall, context));
    }
    return parts;
}
