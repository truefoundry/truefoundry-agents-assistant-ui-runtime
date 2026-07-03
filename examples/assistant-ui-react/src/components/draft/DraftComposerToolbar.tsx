"use client";

import { DropdownMenu } from "radix-ui";
import { AudioLinesIcon, ChevronDownIcon, MicIcon } from "lucide-react";
import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

import { cn } from "@/lib/utils";

const REASONING_LEVELS = ["none", "minimal", "low", "medium", "high"] as const;

const pillClassName = cn(
    "flex h-6 items-center gap-1 rounded-2xl px-1.5 text-xs font-medium text-[#162235]",
    "hover:bg-[#e8f2fe]/60 data-[state=open]:bg-[#e8f2fe]/60",
);

const menuContentClassName = cn(
    "bg-white border border-[#e0ecfd] z-50 min-w-[12rem] overflow-hidden rounded-lg p-1",
    "shadow-[0px_2px_3px_rgba(0,52,102,0.06),0px_8px_10px_rgba(0,52,102,0.1)]",
);

const menuItemClassName = cn(
    "flex cursor-pointer items-center rounded px-2 py-1.5 text-xs text-[#162235] outline-none select-none",
    "hover:bg-[#e8f2fe]/60 focus:bg-[#e8f2fe]/60",
);

type DraftReasoningSelectorProps = {
    model: AgentSpec["model"];
    disabled?: boolean;
    onChange: (model: AgentSpec["model"]) => void;
};

export function DraftReasoningSelector({
    model,
    disabled,
    onChange,
}: DraftReasoningSelectorProps) {
    const effort = model.params?.reasoningEffort ?? "low";
    const label = effort.charAt(0).toUpperCase() + effort.slice(1);

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild disabled={disabled}>
                <button type="button" className={pillClassName} aria-label="Select reasoning effort">
                    <span>{label}</span>
                    <ChevronDownIcon className="size-4 shrink-0 text-[#4d6896]" />
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    side="top"
                    align="end"
                    sideOffset={6}
                    className={menuContentClassName}
                >
                    {REASONING_LEVELS.map((level) => (
                        <DropdownMenu.Item
                            key={level}
                            className={menuItemClassName}
                            onSelect={() =>
                                onChange({
                                    ...model,
                                    params: { ...model.params, reasoningEffort: level },
                                })
                            }
                        >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

type DraftSendButtonProps = {
    disabled?: boolean;
    onClick: () => void;
};

export function DraftSendButton({ disabled, onClick }: DraftSendButtonProps) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-label="Send message"
            className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-2xl bg-[#010202] p-1",
                "shadow-[0px_1px_3px_rgba(0,52,102,0.03),0px_1px_2px_rgba(0,52,102,0.08)]",
                "disabled:opacity-50",
            )}
        >
            <AudioLinesIcon className="size-3.5 text-white" />
        </button>
    );
}

export function DraftMicButton({ disabled }: { disabled?: boolean }) {
    return (
        <button
            type="button"
            disabled={disabled}
            aria-label="Voice input"
            className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-2xl text-[#162235]",
                "hover:bg-[#e8f2fe]/60 disabled:opacity-50",
            )}
        >
            <MicIcon className="size-3.5" />
        </button>
    );
}
