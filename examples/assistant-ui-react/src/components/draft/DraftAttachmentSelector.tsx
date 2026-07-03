"use client";

import { useState } from "react";
import { Popover } from "radix-ui";
import {
    ChevronRightIcon,
    PaperclipIcon,
    PlugIcon,
    PlusIcon,
    ScrollTextIcon,
} from "lucide-react";
import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

import { DraftConnectorSelectorPanel } from "@/components/draft/DraftConnectorSelectorPanel";
import { DraftSkillsSelectorPanel } from "@/components/draft/DraftSkillsSelectorPanel";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
    draftIconClassName,
    draftMenuClassName,
    draftMenuItemClassName,
    draftRowActiveClassName,
    draftTriggerButtonClassName,
} from "@/components/draft/draftComposerStyles";
import { cn } from "@/lib/utils";

type SubmenuView = "connectors" | "skills" | null;

export type DraftAttachmentSelectorProps = {
    disabled?: boolean;
    mcpServers: NonNullable<AgentSpec["mcpServers"]>;
    skills: NonNullable<AgentSpec["skills"]>;
    onMcpServersChange: (mcpServers: NonNullable<AgentSpec["mcpServers"]>) => void;
    onSkillsChange: (skills: NonNullable<AgentSpec["skills"]>) => void;
    onPickFile: () => void;
};

const popoverSurfaceClassName = cn("pointer-events-auto flex items-end gap-2");

const mainMenuClassName = cn(
    draftMenuClassName,
    "flex min-w-[11rem] shrink-0 flex-col gap-1 px-3 py-4",
);

const menuItemWithChevronClassName = cn(draftMenuItemClassName, "justify-between");

export function DraftAttachmentSelector({
    disabled,
    mcpServers,
    skills,
    onMcpServersChange,
    onSkillsChange,
    onPickFile,
}: DraftAttachmentSelectorProps) {
    const [open, setOpen] = useState(false);
    const [submenu, setSubmenu] = useState<SubmenuView>(null);

    function handleOpenChange(next: boolean) {
        setOpen(next);
        if (!next) {
            setSubmenu(null);
        }
    }

    return (
        <Popover.Root open={open} onOpenChange={handleOpenChange} modal={false}>
            <Popover.Trigger asChild disabled={disabled}>
                <TooltipIconButton
                    tooltip="Add attachment"
                    side="top"
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    className={draftTriggerButtonClassName}
                    aria-label="Add attachment"
                    aria-haspopup="dialog"
                >
                    <PlusIcon className="size-3 stroke-[1.75px] text-foreground" />
                </TooltipIconButton>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="top"
                    align="start"
                    sideOffset={6}
                    collisionPadding={16}
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    onCloseAutoFocus={(event) => event.preventDefault()}
                    className="z-50 border-0 bg-transparent p-0 shadow-none outline-none"
                >
                    <div className={popoverSurfaceClassName}>
                        <div className={mainMenuClassName}>
                            <button
                                type="button"
                                className={draftMenuItemClassName}
                                onClick={() => {
                                    setOpen(false);
                                    setSubmenu(null);
                                    onPickFile();
                                }}
                            >
                                <PaperclipIcon className={cn("size-3.5", draftIconClassName)} />
                                Add Files or photos
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    menuItemWithChevronClassName,
                                    submenu === "connectors" && draftRowActiveClassName,
                                )}
                                onClick={() => setSubmenu("connectors")}
                            >
                                <span className="flex items-center gap-1">
                                    <PlugIcon className={cn("size-3.5", draftIconClassName)} />
                                    Connectors
                                </span>
                                <ChevronRightIcon className={cn("size-3", draftIconClassName)} />
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    menuItemWithChevronClassName,
                                    submenu === "skills" && draftRowActiveClassName,
                                )}
                                onClick={() => setSubmenu("skills")}
                            >
                                <span className="flex items-center gap-1">
                                    <ScrollTextIcon className={cn("size-3.5", draftIconClassName)} />
                                    Skills
                                </span>
                                <ChevronRightIcon className={cn("size-3", draftIconClassName)} />
                            </button>
                        </div>

                        {submenu === "connectors" && (
                            <DraftConnectorSelectorPanel
                                selected={mcpServers}
                                disabled={disabled}
                                onChange={onMcpServersChange}
                            />
                        )}
                        {submenu === "skills" && (
                            <DraftSkillsSelectorPanel
                                selected={skills}
                                disabled={disabled}
                                onChange={onSkillsChange}
                            />
                        )}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
