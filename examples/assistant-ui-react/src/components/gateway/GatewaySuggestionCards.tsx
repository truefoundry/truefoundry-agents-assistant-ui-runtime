"use client";

import { useAui } from "@assistant-ui/react";

import { cn } from "@/lib/utils";

const SUGGESTIONS = [
    {
        title: "Data",
        description: "Analyze the attached CSV and surface the top 3 trends",
        prompt: "Analyze the attached CSV and surface the top 3 trends",
    },
    {
        title: "Planning",
        description: "Draft a launch plan with milestones",
        prompt: "Draft a launch plan with milestones",
    },
    {
        title: "Coding",
        description: "Review this function for bugs and edge cases",
        prompt: "Review this function for bugs and edge cases",
    },
] as const;

export function GatewaySuggestionCards({ className }: { className?: string }) {
    const aui = useAui();

    return (
        <div
            className={cn(
                "flex w-full flex-wrap items-stretch justify-center gap-4",
                className,
            )}
        >
            {SUGGESTIONS.map((item) => (
                <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                        aui.composer().setText(item.prompt);
                        void aui.composer().send();
                    }}
                    className={cn(
                        "flex w-[180px] flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors",
                        "border-[var(--gateway-card-border)] bg-card hover:bg-accent/40",
                    )}
                >
                    <span className="text-xs font-medium tracking-wide text-foreground">
                        {item.title}
                    </span>
                    <span className="text-xs leading-4 tracking-wide text-muted-foreground">
                        {item.description}
                    </span>
                </button>
            ))}
        </div>
    );
}
