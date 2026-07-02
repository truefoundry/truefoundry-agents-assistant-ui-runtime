import { ArchiveIcon, MoreHorizontalIcon, TrashIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";

import { cn } from "./lib/cn.js";
import { IconButton } from "./primitives/IconButton.js";

export type ThreadListRowProps = {
    title: string;
    active: boolean;
    onSelect: () => void;
    onArchive?: () => void;
    onDelete?: () => void;
    className?: string;
};

export function ThreadListRow({ title, active, onSelect, onArchive, onDelete, className }: ThreadListRowProps) {
    return (
        <div
            data-slot="aui_thread-list-item"
            data-active={active || undefined}
            className={cn(
                "group hover:bg-muted data-[active]:bg-muted relative flex min-h-9 items-center rounded-lg transition-colors",
                className,
            )}
        >
            <button
                type="button"
                onClick={onSelect}
                data-slot="aui_thread-list-item-trigger"
                className="flex min-h-9 min-w-0 flex-1 items-center rounded-lg px-2.5 py-2 text-start text-sm outline-none group-hover:pe-9"
            >
                <span className="min-w-0 flex-1 truncate">{title}</span>
            </button>
            {(onArchive || onDelete) && (
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <IconButton
                            tooltip="More options"
                            className="absolute end-1.5 top-1/2 size-6 -translate-y-1/2 p-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                        >
                            <MoreHorizontalIcon className="size-3.5" />
                        </IconButton>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            side="right"
                            align="start"
                            sideOffset={6}
                            className="bg-popover/95 text-popover-foreground z-50 min-w-32 overflow-hidden rounded-xl border p-1.5 shadow-lg backdrop-blur-sm"
                        >
                            {onArchive && (
                                <DropdownMenu.Item
                                    onSelect={onArchive}
                                    className="hover:bg-accent hover:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
                                >
                                    <ArchiveIcon className="size-4" />
                                    Archive
                                </DropdownMenu.Item>
                            )}
                            {onDelete && (
                                <DropdownMenu.Item
                                    onSelect={onDelete}
                                    className="text-destructive hover:bg-destructive/10 flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
                                >
                                    <TrashIcon className="size-4" />
                                    Delete
                                </DropdownMenu.Item>
                            )}
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            )}
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        ThreadListRow: typeof ThreadListRow;
    }
}
