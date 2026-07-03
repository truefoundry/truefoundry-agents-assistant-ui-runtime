"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type DraftComposerShellProps = {
    value: string;
    placeholder: string;
    disabled: boolean;
    modelLabel?: string;
    connectorStatusLabel?: string;
    configPanels: ReactNode;
    onValueChange: (value: string) => void;
    onSubmit: () => void;
    onAttach?: () => void;
};

export function DraftComposerShell({
    value,
    placeholder,
    disabled,
    modelLabel,
    connectorStatusLabel,
    configPanels,
    onValueChange,
    onSubmit,
    onAttach,
}: DraftComposerShellProps) {
    const [configOpen, setConfigOpen] = useState(true);

    return (
        <div className="border-border/60 bg-muted flex w-full flex-col gap-3 rounded-3xl border p-2 shadow-sm">
            <button
                type="button"
                onClick={() => setConfigOpen((open) => !open)}
                className="text-muted-foreground flex items-center justify-between px-2 text-xs font-medium"
            >
                <span>Draft agent configuration</span>
                <ChevronDownIcon
                    className={cn(
                        "size-4 transition-transform",
                        configOpen ? "rotate-180" : "",
                    )}
                />
            </button>
            {configOpen && (
                <div className="space-y-3 border-t border-border/40 px-2 pt-3">
                    {configPanels}
                </div>
            )}
            <textarea
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                rows={2}
                aria-label="Message input"
                onChange={(event) => onValueChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        onSubmit();
                    }
                }}
                className="placeholder:text-muted-foreground/80 max-h-32 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex flex-wrap items-center gap-2">
                    {onAttach != null && (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={onAttach}
                            className="text-muted-foreground rounded-full px-2 py-1 text-xs underline"
                        >
                            Attach
                        </button>
                    )}
                    {connectorStatusLabel != null && (
                        <span className="text-muted-foreground text-xs">
                            {connectorStatusLabel}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {modelLabel != null && (
                        <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                            {modelLabel}
                        </span>
                    )}
                    <button
                        type="button"
                        disabled={disabled || value.trim().length === 0}
                        onClick={onSubmit}
                        className="bg-foreground text-background rounded-full px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
