import type { ReactNode } from "react";
import { ChevronDownIcon, LoaderIcon } from "lucide-react";

import { cn } from "./lib/cn.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./primitives/Collapsible.js";

export type ToolGroupCardProps = {
    toolCallCount: number;
    expanded: boolean;
    active?: boolean;
    onToggle: () => void;
    children: ReactNode;
    className?: string;
};

export function ToolGroupCard({
    toolCallCount,
    expanded,
    active = false,
    onToggle,
    children,
    className,
}: ToolGroupCardProps) {
    const label = `${toolCallCount} tool ${toolCallCount === 1 ? "call" : "calls"}`;

    return (
        <Collapsible
            data-slot="tool-group-card"
            open={expanded}
            onOpenChange={onToggle}
            className={cn("aui-tool-group-card group/tool-group w-full", className)}
        >
            <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]">
                {active && <LoaderIcon className="size-3 shrink-0 animate-spin [animation-duration:0.6s]" />}
                <span className="text-xs font-medium">{label}</span>
                <ChevronDownIcon
                    className={cn(
                        "size-3 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                        expanded ? "rotate-0" : "-rotate-90",
                    )}
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 flex flex-col gap-1">{children}</CollapsibleContent>
        </Collapsible>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        ToolGroupCard: typeof ToolGroupCard;
    }
}
