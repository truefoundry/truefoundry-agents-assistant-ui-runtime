import type { ReactNode } from "react";
import { BrainIcon, ChevronDownIcon } from "lucide-react";

import { cn } from "./lib/cn.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./primitives/Collapsible.js";

export type ReasoningCardProps = {
    streaming: boolean;
    expanded: boolean;
    onToggle: () => void;
    children: ReactNode;
    className?: string;
};

export function ReasoningCard({ streaming, expanded, onToggle, children, className }: ReasoningCardProps) {
    return (
        <Collapsible
            data-slot="reasoning-card"
            open={expanded}
            onOpenChange={onToggle}
            className={cn("aui-reasoning-card w-full rounded-lg border px-3 py-2", className)}
        >
            <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex max-w-[75%] origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]">
                <BrainIcon className="size-4 shrink-0" />
                <span className="leading-none tabular-nums">
                    Reasoning
                    {streaming && (
                        <span aria-hidden className="shimmer pointer-events-none">
                            {" "}
                            …
                        </span>
                    )}
                </span>
                <ChevronDownIcon
                    className={cn(
                        "mt-0.5 size-4 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                        expanded ? "rotate-0" : "-rotate-90",
                    )}
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="text-muted-foreground max-h-64 overflow-y-auto pt-2 pb-1 pl-6 text-sm leading-relaxed">
                {children}
            </CollapsibleContent>
        </Collapsible>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        ReasoningCard: typeof ReasoningCard;
    }
}
