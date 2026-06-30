import type { MessagePrimitive } from "@assistant-ui/react";

import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { Reasoning } from "@/components/assistant-ui/reasoning";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";

/**
 * Default assistant message part renderers (assistant-ui Tool UI docs).
 * ToolFallback handles server-side approval gates via `approval` + `respondToApproval`.
 */
export const assistantMessagePartComponents = {
    Text: MarkdownText,
    Reasoning,
    tools: { Fallback: ToolFallback },
} satisfies NonNullable<MessagePrimitive.Parts.Props["components"]>;
