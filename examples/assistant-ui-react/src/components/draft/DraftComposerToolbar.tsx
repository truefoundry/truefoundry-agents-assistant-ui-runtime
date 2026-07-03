"use client";

import { DropdownMenu } from "radix-ui";
import { ArrowUpIcon, ChevronDownIcon, LoaderIcon } from "lucide-react";
import type { AgentSpec, AgentSpecUpdate } from "truefoundry-agents-assistant-ui-runtime";

import { cn } from "@/lib/utils";
import {
    draftCancelButtonClassName,
    draftIconClassName,
    draftMenuClassName,
    draftMenuItemClassName,
    draftPillClassName,
    draftSendButtonClassName,
} from "@/components/draft/draftComposerStyles";

const REASONING_LEVELS = ["none", "minimal", "low", "medium", "high"] as const;

type DraftReasoningSelectorProps = {
    model: AgentSpec["model"];
    disabled?: boolean;
    onChange: (model: NonNullable<AgentSpecUpdate["model"]>) => void;
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
                <button type="button" className={draftPillClassName} aria-label="Select reasoning effort">
                    <span>{label}</span>
                    <ChevronDownIcon className={cn("size-4 shrink-0", draftIconClassName)} />
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    side="top"
                    align="end"
                    sideOffset={6}
                    className={cn(draftMenuClassName, "z-50 min-w-[12rem] overflow-hidden p-1")}
                >
                    {REASONING_LEVELS.map((level) => (
                        <DropdownMenu.Item
                            key={level}
                            className={draftMenuItemClassName}
                            onSelect={() =>
                                onChange({
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
    isRunning?: boolean;
    onClick: () => void;
};

export function DraftSendButton({ disabled, isRunning, onClick }: DraftSendButtonProps) {
    if (isRunning) {
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                aria-label="Cancel"
                className={draftCancelButtonClassName}
            >
                <LoaderIcon className="size-3.5 animate-spin [animation-duration:0.6s]" />
                Cancel
            </button>
        );
    }

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-label="Send message"
            className={draftSendButtonClassName}
        >
            <ArrowUpIcon className="size-3.5" />
        </button>
    );
}
