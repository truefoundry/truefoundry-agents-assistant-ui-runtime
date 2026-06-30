import type { AssistantState } from "@assistant-ui/react";

export function threadHasPendingMcpAuth(state: AssistantState): boolean {
    const lastAssistant = state.thread.messages.findLast(
        (message) => message.role === "assistant",
    );
    return (
        lastAssistant?.status?.type === "requires-action" &&
        lastAssistant.metadata.custom.pendingMcpAuth === true
    );
}
