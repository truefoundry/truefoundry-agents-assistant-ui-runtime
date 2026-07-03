"use client";

import { ScrollTextIcon } from "lucide-react";
import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

import { useDraftComposerCatalog } from "@/components/draft/DraftComposerCatalog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DraftSkillChipsProps = {
    selected: NonNullable<AgentSpec["skills"]>;
};

export function DraftSkillChips({ selected }: DraftSkillChipsProps) {
    const { skills } = useDraftComposerCatalog();

    if (selected.length === 0) {
        return null;
    }

    const count = selected.length;
    const badgeLabel = count === 1 ? "1 Skill" : `${count} Skills`;
    const tooltipLabel = selected
        .map((skill) => {
            const catalogSkill = skills.find((item) => item.fqn === skill.fqn);
            return catalogSkill?.name ?? skill.fqn;
        })
        .join(", ");

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        aria-label={badgeLabel}
                        className={cn(
                            "flex h-6 shrink-0 cursor-default items-center gap-1 rounded-md border border-[#cee0f8] bg-[#f0f7ff] px-1.5",
                            "text-xs font-medium text-[#162236]",
                        )}
                    >
                        <ScrollTextIcon className="size-3.5 shrink-0 text-[#4d6896]" />
                        <span>{badgeLabel}</span>
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top">{tooltipLabel}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
