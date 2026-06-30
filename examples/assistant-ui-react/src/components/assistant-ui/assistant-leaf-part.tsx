import type { EnrichedPartState, ToolCallMessagePartComponent } from "@assistant-ui/react";
import type { FC } from "react";

import { assistantMessagePartComponents } from "@/components/assistant-ui/assistant-message-parts";

const TextPart = assistantMessagePartComponents.Text!;
const ReasoningPart = assistantMessagePartComponents.Reasoning!;
const DefaultToolFallback = assistantMessagePartComponents.tools!.Fallback!;

/**
 * Renders a single GroupedParts leaf using the official part components.
 * Tool calls use ToolFallback (Allow/Deny) unless a toolkit UI is registered (`part.toolUI`).
 */
export const AssistantLeafPart: FC<{
    part: EnrichedPartState;
    ToolFallback?: ToolCallMessagePartComponent;
}> = ({ part, ToolFallback = DefaultToolFallback }) => {
    switch (part.type) {
        case "text":
            return <TextPart />;
        case "reasoning":
            return <ReasoningPart {...part} />;
        case "tool-call":
            return part.toolUI ?? <ToolFallback {...part} />;
        case "data":
            return part.dataRendererUI ?? null;
        default:
            return null;
    }
};
