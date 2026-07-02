import { CheckIcon, CopyIcon, DownloadIcon, MoreHorizontalIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";

import { cn } from "./lib/cn.js";
import { IconButton } from "./primitives/IconButton.js";

export type MessageActionBarProps = {
    isCopied: boolean;
    onCopy: () => void;
    onExportMarkdown: () => void;
    className?: string;
};

export function MessageActionBar({ isCopied, onCopy, onExportMarkdown, className }: MessageActionBarProps) {
    return (
        <div
            className={cn(
                "aui-assistant-action-bar-root text-muted-foreground animate-in fade-in flex gap-1 duration-200",
                className,
            )}
        >
            <IconButton tooltip="Copy" onClick={onCopy}>
                {isCopied ? (
                    <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />
                ) : (
                    <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />
                )}
            </IconButton>
            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                    <IconButton tooltip="More" className="data-[state=open]:bg-accent">
                        <MoreHorizontalIcon />
                    </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        className="aui-action-bar-more-content bg-popover/95 text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1.5 shadow-lg backdrop-blur-sm"
                    >
                        <DropdownMenu.Item
                            onSelect={onExportMarkdown}
                            className="aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
                        >
                            <DownloadIcon className="size-4" />
                            Export as Markdown
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        MessageActionBar: typeof MessageActionBar;
    }
}
