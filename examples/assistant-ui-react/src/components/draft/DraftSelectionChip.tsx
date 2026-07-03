"use client";

import type { ReactNode } from "react";

import { draftChipClassName } from "@/components/draft/draftComposerStyles";
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
                            draftChipClassName,
                            "flex size-6 shrink-0 cursor-default items-center justify-center rounded-md",
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
