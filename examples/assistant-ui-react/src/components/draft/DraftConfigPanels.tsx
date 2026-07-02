"use client";

import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

type InstructionsEditorProps = {
    value: string;
    disabled?: boolean;
    onChange: (instructions: string) => void;
};

export function InstructionsEditor({
    value,
    disabled,
    onChange,
}: InstructionsEditorProps) {
    return (
        <div className="space-y-2">
            <label className="text-muted-foreground block text-xs font-medium">
                Instructions
            </label>
            <textarea
                value={value}
                disabled={disabled}
                rows={4}
                onChange={(event) => onChange(event.target.value)}
                placeholder="System prompt for the draft agent..."
                className="border-input bg-background w-full resize-y rounded-md border px-2 py-1.5 text-sm"
            />
        </div>
    );
}

type McpServersPanelProps = {
    mcpServers: NonNullable<AgentSpec["mcpServers"]>;
    disabled?: boolean;
    onChange: (mcpServers: NonNullable<AgentSpec["mcpServers"]>) => void;
};

export function McpServersPanel({
    mcpServers,
    disabled,
    onChange,
}: McpServersPanelProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-xs font-medium">
                    MCP servers
                </label>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                        onChange([
                            ...mcpServers,
                            { name: "", enableTools: ["@all"] },
                        ])
                    }
                    className="text-xs underline disabled:opacity-50"
                >
                    Add MCP
                </button>
            </div>
            {mcpServers.length === 0 && (
                <p className="text-muted-foreground text-xs">No MCP servers attached.</p>
            )}
            {mcpServers.map((server, index) => (
                <div key={index} className="flex gap-2">
                    <input
                        value={server.name}
                        disabled={disabled}
                        placeholder="Server name (e.g. zendesk)"
                        onChange={(event) => {
                            const next = [...mcpServers];
                            next[index] = { ...server, name: event.target.value };
                            onChange(next);
                        }}
                        className="border-input bg-background min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
                    />
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(mcpServers.filter((_, i) => i !== index))}
                        className="text-muted-foreground text-xs underline"
                    >
                        Remove
                    </button>
                </div>
            ))}
        </div>
    );
}

type SkillsPanelProps = {
    skills: NonNullable<AgentSpec["skills"]>;
    disabled?: boolean;
    onChange: (skills: NonNullable<AgentSpec["skills"]>) => void;
};

export function SkillsPanel({ skills, disabled, onChange }: SkillsPanelProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-xs font-medium">
                    Skills
                </label>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                        onChange([
                            ...skills,
                            {
                                fqn: "agent-skill:truefoundry/skills/web-search:1",
                                preload: false,
                            },
                        ])
                    }
                    className="text-xs underline disabled:opacity-50"
                >
                    Add skill
                </button>
            </div>
            {skills.length === 0 && (
                <p className="text-muted-foreground text-xs">No skills mounted.</p>
            )}
            {skills.map((skill, index) => (
                <div key={index} className="flex items-center gap-2">
                    <input
                        value={skill.fqn}
                        disabled={disabled}
                        placeholder="agent-skill:org/skills/name:1"
                        onChange={(event) => {
                            const next = [...skills];
                            next[index] = { ...skill, fqn: event.target.value };
                            onChange(next);
                        }}
                        className="border-input bg-background min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
                    />
                    <label className="text-muted-foreground flex items-center gap-1 text-xs">
                        <input
                            type="checkbox"
                            disabled={disabled}
                            checked={skill.preload ?? false}
                            onChange={(event) => {
                                const next = [...skills];
                                next[index] = {
                                    ...skill,
                                    preload: event.target.checked,
                                };
                                onChange(next);
                            }}
                        />
                        Preload
                    </label>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(skills.filter((_, i) => i !== index))}
                        className="text-muted-foreground text-xs underline"
                    >
                        Remove
                    </button>
                </div>
            ))}
        </div>
    );
}
