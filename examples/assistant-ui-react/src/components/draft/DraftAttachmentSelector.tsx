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

const popoverSurfaceClassName = cn(
    "pointer-events-auto flex items-start gap-2 rounded-lg",
);

const mainMenuClassName = cn(
    "bg-white border border-[#e0ecfd] text-[#162235]",
    "flex min-w-[11rem] shrink-0 flex-col gap-1 rounded-lg px-3 py-4",
    "shadow-[0px_2px_3px_rgba(0,52,102,0.06),0px_8px_10px_rgba(0,52,102,0.1)]",
);

const menuItemClassName = cn(
    "flex w-full cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-xs font-medium outline-none select-none",
    "hover:bg-[#e8f2fe]/60 focus-visible:bg-[#e8f2fe]/60",
);

const menuItemActiveClassName = "bg-[#e8f2fe]/60";

const menuItemWithChevronClassName = cn(menuItemClassName, "justify-between");

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
                    className="size-6 rounded-2xl p-1.5 hover:bg-[#e8f2fe]/60 data-[state=open]:bg-[#e8f2fe]/60"
                    aria-label="Add attachment"
                    aria-haspopup="dialog"
                >
                    <PlusIcon className="size-3 stroke-[1.75px] text-[#162235]" />
                </TooltipIconButton>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="top"
                    align="start"
                    sideOffset={8}
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    onCloseAutoFocus={(event) => event.preventDefault()}
                    className="z-50 border-0 bg-transparent p-0 shadow-none outline-none"
                >
                    <div className={popoverSurfaceClassName}>
                        <div className={mainMenuClassName}>
                            <button
                                type="button"
                                className={menuItemClassName}
                                onClick={() => {
                                    setOpen(false);
                                    setSubmenu(null);
                                    onPickFile();
                                }}
                            >
                                <PaperclipIcon className="size-3.5 text-[#4d6896]" />
                                Add Files or photos
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    menuItemWithChevronClassName,
                                    submenu === "connectors" && menuItemActiveClassName,
                                )}
                                onClick={() => setSubmenu("connectors")}
                            >
                                <span className="flex items-center gap-1">
                                    <PlugIcon className="size-3.5 text-[#4d6896]" />
                                    Connectors
                                </span>
                                <ChevronRightIcon className="size-3 text-[#4d6896]" />
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    menuItemWithChevronClassName,
                                    submenu === "skills" && menuItemActiveClassName,
                                )}
                                onClick={() => setSubmenu("skills")}
                            >
                                <span className="flex items-center gap-1">
                                    <ScrollTextIcon className="size-3.5 text-[#4d6896]" />
                                    Skills
                                </span>
                                <ChevronRightIcon className="size-3 text-[#4d6896]" />
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
