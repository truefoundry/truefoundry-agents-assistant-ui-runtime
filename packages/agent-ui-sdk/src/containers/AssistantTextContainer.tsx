"use client";

import { useAuiState } from "@assistant-ui/react";

import { useSlot } from "../theme/SlotsProvider.js";

export function AssistantTextContainer() {
    const Markdown = useSlot("Markdown");
    const text = useAuiState((s) =>
        s.part.type === "text" || s.part.type === "reasoning" ? s.part.text : "",
    );
    const isStreaming = useAuiState((s) => {
        if (s.message.status?.type !== "running") return false;
        const lastIndex = s.message.parts.length - 1;
        if (lastIndex < 0) return false;
        if (s.part.type !== "text" && s.part.type !== "reasoning") return false;
        return s.message.parts[lastIndex] === s.part;
    });

    return <Markdown content={text} isStreaming={isStreaming} />;
}
