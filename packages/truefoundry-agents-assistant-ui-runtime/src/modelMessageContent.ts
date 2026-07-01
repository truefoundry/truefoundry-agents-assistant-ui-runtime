import type { ThreadAssistantMessagePart } from "@assistant-ui/core";
import type { ModelMessageEvent } from "truefoundry-gateway-sdk/agents";

import { parseAskUserQuestionArgs } from "./askUserQuestion.js";
import type { PendingResponseRef } from "./foldPeerThreads.js";

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

function toolCallToPart(
    toolCall: SdkToolCall,
    context?: ToolCallContext,
): Extract<AssistantContentPart, { type: "tool-call" }> {
    const argsText = toolCall.function.arguments ?? "";
    const toolResult = context?.toolResults?.get(toolCall.id);
    const pendingApproval = context?.pendingApprovals?.get(toolCall.id);
    const approvalDecision = context?.approvalDecisions?.get(toolCall.id);
    const pendingResponse = context?.pendingResponses?.get(toolCall.id);

    let interrupt: Extract<AssistantContentPart, { type: "tool-call" }>["interrupt"];
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

    // A resolved approval takes precedence over a pending one: it carries the
    // allow/deny decision, and a denial synthesizes an error result (mirroring
    // the projection overlay) when the tool never executed.
    const approval = approvalDecision ?? pendingApproval;
    const isDenied = approvalDecision != null && approvalDecision.approved === false;
    const result =
        toolResult !== undefined
            ? toolResult
            : isDenied
              ? { error: approvalDecision!.reason || "Tool approval denied" }
              : undefined;

    return {
        type: "tool-call",
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        argsText,
        args: parseToolArgs(argsText),
        ...(result !== undefined ? { result } : {}),
        ...(isDenied && toolResult === undefined ? { isError: true } : {}),
        ...(approval != null
            ? {
                  approval:
                      approvalDecision != null
                          ? {
                                id: approvalDecision.id,
                                approved: approvalDecision.approved,
                                ...(approvalDecision.reason != null
                                    ? { reason: approvalDecision.reason }
                                    : {}),
                            }
                          : { id: pendingApproval!.id },
              }
            : {}),
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
