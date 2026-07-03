"use client";

import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

import { DraftAttachmentSelector } from "@/components/draft/DraftAttachmentSelector";
import { DraftConnectorChips } from "@/components/draft/DraftConnectorChips";
import { DraftSkillChips } from "@/components/draft/DraftSkillChips";

type DraftComposerAttachBarProps = {
    disabled?: boolean;
    mcpServers: NonNullable<AgentSpec["mcpServers"]>;
    skills: NonNullable<AgentSpec["skills"]>;
    onMcpServersChange: (mcpServers: NonNullable<AgentSpec["mcpServers"]>) => void;
    onSkillsChange: (skills: NonNullable<AgentSpec["skills"]>) => void;
    onPickFile: () => void;
};

export function DraftComposerAttachBar({
    disabled,
    mcpServers,
    skills,
    onMcpServersChange,
    onSkillsChange,
    onPickFile,
}: DraftComposerAttachBarProps) {
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <DraftAttachmentSelector
                disabled={disabled}
                mcpServers={mcpServers}
                skills={skills}
                onMcpServersChange={onMcpServersChange}
                onSkillsChange={onSkillsChange}
                onPickFile={onPickFile}
            />
            <DraftConnectorChips selected={mcpServers} />
            <DraftSkillChips selected={skills} />
        </div>
    );
}
