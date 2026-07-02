"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useAgentMode, type AgentRuntimeMode } from "@/lib/draft/agentMode";

const MODES: { id: AgentRuntimeMode; label: string }[] = [
    { id: "named", label: "Saved agent" },
    { id: "draft", label: "Draft agent" },
];

export function AgentModeToggle() {
    const { mode, setMode } = useAgentMode();

    return (
        <div className="border-border flex items-center gap-1 border-b px-3 py-2">
            {MODES.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={
                        mode === item.id
                            ? "bg-foreground text-background rounded-full px-3 py-1 text-xs font-medium"
                            : "text-muted-foreground rounded-full px-3 py-1 text-xs"
                    }
                >
                    {item.label}
                </button>
            ))}
            <ThemeToggle className="ml-auto" />
        </div>
    );
}
