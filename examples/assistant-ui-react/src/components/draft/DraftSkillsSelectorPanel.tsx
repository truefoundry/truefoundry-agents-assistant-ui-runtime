"use client";

import { useMemo, useState } from "react";
import { ScrollTextIcon } from "lucide-react";
import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

import { useDraftComposerCatalog } from "@/components/draft/DraftComposerCatalog";
import { isSkillSelected, toggleSkill } from "@/components/draft/draftSelection";
import {
    DraftSelectorList,
    DraftSelectorRow,
    DraftSelectorSearch,
    DraftSelectorSectionHeader,
    draftMutedTextClassName,
} from "@/components/draft/DraftSelectorPanel";
import { cn } from "@/lib/utils";

type DraftSkillsSelectorPanelProps = {
    selected: NonNullable<AgentSpec["skills"]>;
    disabled?: boolean;
    onChange: (skills: NonNullable<AgentSpec["skills"]>) => void;
};

export function DraftSkillsSelectorPanel({
    selected,
    disabled,
    onChange,
}: DraftSkillsSelectorPanelProps) {
    const [query, setQuery] = useState("");
    const { skills, skillsLoading: isLoading, skillsError: error } = useDraftComposerCatalog();

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return skills;
        return skills.filter(
            (skill) =>
                skill.name.toLowerCase().includes(needle) ||
                skill.fqn.toLowerCase().includes(needle),
        );
    }, [skills, query]);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
            <DraftSelectorSearch
                value={query}
                disabled={disabled}
                placeholder="Search skills..."
                onChange={setQuery}
            />
            <DraftSelectorSectionHeader label={`AVAILABLE (${filtered.length})`} />
            <DraftSelectorList isLoading={isLoading} error={error}>
                {filtered.length === 0 && !isLoading && !error ? (
                    <p className={cn("px-2 py-2 text-xs", draftMutedTextClassName)}>No skills found.</p>
                ) : (
                    filtered.map((skill) => (
                        <DraftSelectorRow
                            key={skill.fqn}
                            icon={<ScrollTextIcon className="size-3.5" />}
                            label={skill.name}
                            checked={isSkillSelected(selected, skill.fqn)}
                            disabled={disabled}
                            onCheckedChange={(next) =>
                                onChange(toggleSkill(selected, skill, next))
                            }
                        />
                    ))
                )}
            </DraftSelectorList>
        </div>
    );
}
