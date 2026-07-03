import type { ThreadAssistantMessagePart, ThreadMessage } from "@assistant-ui/core";
import type { McpAuthRequiredEvent } from "truefoundry-gateway-sdk/agents";

import { ROOT_THREAD_ID } from "./constants.js";
import type { TrueFoundryMessageCustomMetadata } from "./messageCustomMetadata.js";
import {
    getToolApprovalThreadId,
    hasPendingToolApproval,
} from "./toolApproval.js";
import {
    getToolResponseThreadId,
    hasPendingToolResponse,
    type AskUserQuestionInterruptPayload,
} from "./toolResponse.js";

export type PendingApproval = {
    approvalId: string;
    threadId: string;
    toolName: string;
    args: Record<string, unknown>;
    argsText: string;
};

export type PendingToolResponse = {
    toolCallId: string;
    threadId: string;
    toolName: string;
    args: Record<string, unknown>;
    argsText: string;
    question?: string;
    options?: string[];
};

type ToolCallPart = Extract<
    ThreadMessage["content"][number],
    { type: "tool-call" }
>;

function walkToolCallParts(
    content: readonly ThreadAssistantMessagePart[],
    visit: (part: ToolCallPart, threadId: string) => void,
    threadId: string,
): void {
    for (const part of content) {
        if (part.type !== "tool-call") {
            continue;
        }
        visit(part, threadId);
        if (part.messages == null) {
            continue;
        }
        for (const message of part.messages) {
            if (message.role !== "assistant") {
                continue;
            }
            const nestedThreadId =
                getToolApprovalThreadId(message) ??
                getToolResponseThreadId(message) ??
                threadId;
            walkToolCallParts(message.content, visit, nestedThreadId);
        }
    }
}

export function collectPendingApprovals(
    messages: readonly ThreadMessage[],
): PendingApproval[] {
    const pending: PendingApproval[] = [];

    for (const message of messages) {
        if (message.role !== "assistant") {
            continue;
        }
        const rootThreadId = getToolApprovalThreadId(message) ?? ROOT_THREAD_ID;
        walkToolCallParts(message.content, (part, threadId) => {
            if (!hasPendingToolApproval(part.approval)) {
                return;
            }
            pending.push({
                approvalId: part.approval!.id,
                threadId,
                toolName: part.toolName,
                args: { ...part.args },
                argsText: part.argsText,
            });
        }, rootThreadId);
    }

    return pending;
}

export function collectPendingToolResponses(
    messages: readonly ThreadMessage[],
): PendingToolResponse[] {
    const pending: PendingToolResponse[] = [];

    for (const message of messages) {
        if (message.role !== "assistant") {
            continue;
        }
        const rootThreadId = getToolResponseThreadId(message) ?? ROOT_THREAD_ID;
        walkToolCallParts(message.content, (part, threadId) => {
            if (!hasPendingToolResponse(part)) {
                return;
            }
            const payload = part.interrupt?.payload as
                | AskUserQuestionInterruptPayload
                | undefined;
            pending.push({
                toolCallId: part.toolCallId,
                threadId,
                toolName: part.toolName,
                args: { ...part.args },
                argsText: part.argsText,
                ...(payload?.question != null ? { question: payload.question } : {}),
                ...(payload?.options != null ? { options: payload.options } : {}),
            });
        }, rootThreadId);
    }

    return pending;
}

export function derivePendingMcpAuth(
    messages: readonly ThreadMessage[],
): { mcpServers: McpAuthRequiredEvent["mcpServers"] } | null {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message?.role !== "assistant") {
            continue;
        }
        if (message.status?.type !== "requires-action") {
            continue;
        }
        const custom = message.metadata.custom as TrueFoundryMessageCustomMetadata;
        if (custom.pendingMcpAuth !== true) {
            continue;
        }
        const servers = custom.mcpServers;
        if (!Array.isArray(servers)) {
            return { mcpServers: [] };
        }
        return { mcpServers: servers };
    }
    return null;
}

/**
 * Most recent `sandboxId` observed anywhere in the conversation, scanning backward.
 * Unlike `derivePendingMcpAuth`, this isn't gated on message status: once a sandbox
 * is created it stays valid for the rest of the session, not just the paused message.
 */
export function deriveSandboxId(messages: readonly ThreadMessage[]): string | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message?.role !== "assistant") {
            continue;
        }
        const custom = message.metadata.custom as TrueFoundryMessageCustomMetadata;
        if (typeof custom.sandboxId === "string") {
            return custom.sandboxId;
        }
    }
    return undefined;
}
