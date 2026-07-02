"use client";

import { useState, type PropsWithChildren } from "react";
import type { MessagePrimitive } from "@assistant-ui/react";

import { useSlot } from "../theme/SlotsProvider.js";

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

export function ToolGroupContainer({ group, children }: PropsWithChildren<{ group: ThreadGroupPart }>) {
    const ToolGroupCard = useSlot("ToolGroupCard");
    const [expanded, setExpanded] = useState(true);

    return (
        <ToolGroupCard
            toolCallCount={group.indices.length}
            active={group.status.type === "running"}
            expanded={expanded}
            onToggle={() => setExpanded((prev) => !prev)}
        >
            {children}
        </ToolGroupCard>
    );
}
