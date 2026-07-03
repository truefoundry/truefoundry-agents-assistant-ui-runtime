"use client";

import type { ReactNode } from "react";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DraftSelectionChipProps = {
    label: string;
    children: ReactNode;
};

export function DraftSelectionChip({ label, children }: DraftSelectionChipProps) {
    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        aria-label={label}
                        className={cn(
                            "flex size-6 shrink-0 cursor-default items-center justify-center rounded-md",
                            "border border-[#cee0f8] bg-[#f0f7ff] text-xs font-medium text-[#162236]",
                        )}
                    >
                        {children}
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
