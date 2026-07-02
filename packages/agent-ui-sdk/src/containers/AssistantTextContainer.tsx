"use client";

import { useAuiState } from "@assistant-ui/react";

import { useSlot } from "../theme/SlotsProvider.js";

export function AssistantTextContainer() {
    const Markdown = useSlot("Markdown");
    const text = useAuiState((s) =>
        s.part.type === "text" || s.part.type === "reasoning" ? s.part.text : "",
    );

    return <Markdown content={text} />;
}
