"use client";

import { useState, type PropsWithChildren } from "react";
import { useAuiState } from "@assistant-ui/react";

import { useSlot } from "../theme/SlotsProvider.js";
import type { ThreadGroupPart } from "./ToolGroupContainer.js";

export function ReasoningContainer({ group, children }: PropsWithChildren<{ group: ThreadGroupPart }>) {
    const ReasoningCard = useSlot("ReasoningCard");

    const streaming = useAuiState((s) => {
        if (s.message.status?.type !== "running") return false;
        const lastIndex = s.message.parts.length - 1;
        if (lastIndex < 0) return false;
        if (s.message.parts[lastIndex]?.type !== "reasoning") return false;
        return lastIndex >= group.indices[0]! && lastIndex <= group.indices[group.indices.length - 1]!;
    });

    const [expanded, setExpanded] = useState(streaming);
    const [prevStreaming, setPrevStreaming] = useState(streaming);
    if (streaming !== prevStreaming) {
        setPrevStreaming(streaming);
        if (streaming) setExpanded(true);
    }

    return (
        <ReasoningCard streaming={streaming} expanded={expanded} onToggle={() => setExpanded((prev) => !prev)}>
            {children}
        </ReasoningCard>
    );
}
