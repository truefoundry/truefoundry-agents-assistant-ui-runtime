"use client";

import {
    ChevronRightIcon,
    PaperclipIcon,
    PlugIcon,
    PlusIcon,
    ScrollTextIcon,
} from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { DraftBottomSheet } from "@/components/draft/DraftBottomSheet";
import {
    draftIconClassName,
    draftMenuClassName,
    draftMenuItemClassName,
    draftRowActiveClassName,
    draftTriggerButtonClassName,
} from "@/components/draft/draftComposerStyles";
import { DraftConnectorSelectorPanel } from "@/components/draft/DraftConnectorSelectorPanel";
import { selectorPanelClassName } from "@/components/draft/DraftSelectorPanel";
import { DraftSkillsSelectorPanel } from "@/components/draft/DraftSkillsSelectorPanel";
import { useIsMobile } from "@/lib/useIsMobile";
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

const sheetMenuItemClassName = cn(draftMenuItemClassName, "justify-between py-2.5 text-sm");
const sheetMenuItemWithChevronClassName = cn(sheetMenuItemClassName, "justify-between");

function MainMenuItems({
    submenu,
    itemClassName,
    itemWithChevronClassName,
    onPickFile,
    onSelectSubmenu,
}: {
    submenu: SubmenuView;
    itemClassName: string;
    itemWithChevronClassName: string;
    onPickFile: () => void;
    onSelectSubmenu: (view: SubmenuView) => void;
}) {
    return (
        <>
            <button type="button" className={itemClassName} onClick={onPickFile}>
                <PaperclipIcon className={cn("size-3.5", draftIconClassName)} />
                Add Files or photos
            </button>
            <button
                type="button"
                className={cn(itemWithChevronClassName, submenu === "connectors" && draftRowActiveClassName)}
                onClick={() => onSelectSubmenu("connectors")}
            >
                <span className="flex items-center gap-1">
                    <PlugIcon className={cn("size-3.5", draftIconClassName)} />
                    Connectors
                </span>
                <ChevronRightIcon className={cn("size-3", draftIconClassName)} />
            </button>
            <button
                type="button"
                className={cn(itemWithChevronClassName, submenu === "skills" && draftRowActiveClassName)}
                onClick={() => onSelectSubmenu("skills")}
            >
                <span className="flex items-center gap-1">
                    <ScrollTextIcon className={cn("size-3.5", draftIconClassName)} />
                    Skills
                </span>
                <ChevronRightIcon className={cn("size-3", draftIconClassName)} />
            </button>
        </>
    );
}

export function DraftAttachmentSelector({
    disabled,
    mcpServers,
    skills,
    onMcpServersChange,
    onSkillsChange,
    onPickFile,
}: DraftAttachmentSelectorProps) {
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);
    const [submenu, setSubmenu] = useState<SubmenuView>(null);

    function handleOpenChange(next: boolean) {
        setOpen(next);
        if (!next) {
            setSubmenu(null);
        }
    }

    if (isMobile) {
        const sheetTitle = submenu === "connectors" ? "Connectors" : submenu === "skills" ? "Skills" : "Add to chat";

        return (
            <>
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
                    onClick={() => setOpen(true)}
                >
                    <PlusIcon className="size-3 stroke-[1.75px] text-foreground" />
                </TooltipIconButton>
                <DraftBottomSheet
                    open={open}
                    onOpenChange={handleOpenChange}
                    title={sheetTitle}
                    onBack={submenu != null ? () => setSubmenu(null) : undefined}
                >
                    {submenu == null && (
                        <div className="flex flex-col gap-1 py-2">
                            <MainMenuItems
                                submenu={submenu}
                                itemClassName={sheetMenuItemClassName}
                                itemWithChevronClassName={sheetMenuItemWithChevronClassName}
                                onPickFile={() => {
                                    setOpen(false);
                                    setSubmenu(null);
                                    onPickFile();
                                }}
                                onSelectSubmenu={setSubmenu}
                            />
                        </div>
                    )}
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
                </DraftBottomSheet>
            </>
        );
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
                            <MainMenuItems
                                submenu={submenu}
                                itemClassName={draftMenuItemClassName}
                                itemWithChevronClassName={menuItemWithChevronClassName}
                                onPickFile={() => {
                                    setOpen(false);
                                    setSubmenu(null);
                                    onPickFile();
                                }}
                                onSelectSubmenu={setSubmenu}
                            />
                        </div>

                        {submenu === "connectors" && (
                            <div className={selectorPanelClassName}>
                                <DraftConnectorSelectorPanel
                                    selected={mcpServers}
                                    disabled={disabled}
                                    onChange={onMcpServersChange}
                                />
                            </div>
                        )}
                        {submenu === "skills" && (
                            <div className={selectorPanelClassName}>
                                <DraftSkillsSelectorPanel
                                    selected={skills}
                                    disabled={disabled}
                                    onChange={onSkillsChange}
                                />
                            </div>
                        )}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
