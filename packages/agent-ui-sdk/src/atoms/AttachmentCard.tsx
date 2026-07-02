import { FileTextIcon, XIcon } from "lucide-react";

import { cn } from "./lib/cn.js";
import { Avatar, AvatarFallback, AvatarImage } from "./primitives/Avatar.js";
import { IconButton } from "./primitives/IconButton.js";

export type AttachmentCardSize = "chip" | "preview";

/** Fixed preview bounds for attachments rendered in user message bubbles. */
export const USER_MESSAGE_ATTACHMENT_PREVIEW_REM = 12;

export type AttachmentCardProps = {
    name: string;
    contentType?: string;
    previewSrc?: string;
    isImage?: boolean;
    size?: AttachmentCardSize;
    /** When set, constrains image preview and file chip width to this rem size. */
    previewRem?: number;
    onRemove?: () => void;
    className?: string;
};

export function AttachmentCard({
    name,
    previewSrc,
    isImage = false,
    size = "chip",
    previewRem,
    onRemove,
    className,
}: AttachmentCardProps) {
    if (size === "preview" && isImage && previewSrc) {
        const previewSize =
            previewRem != null ? { width: `${previewRem}rem`, height: `${previewRem}rem` } : undefined;

        return (
            <div
                data-slot="aui_attachment-preview"
                style={previewSize}
                className={cn(
                    "aui-attachment-preview relative shrink-0 cursor-pointer overflow-hidden rounded-lg border",
                    previewRem == null && "size-24",
                    className,
                )}
            >
                <img src={previewSrc} alt={name} className="h-12 w-12 object-cover" />
            </div>
        );
    }

    return (
        <div
            data-slot="aui_attachment-chip"
            style={previewRem != null ? { maxWidth: `${previewRem}rem` } : undefined}
            className={cn(
                "aui-attachment-chip bg-muted flex max-w-full shrink-0 items-center gap-2 rounded-lg border px-2 py-1.5",
                className,
            )}
        >
            <div className="bg-background flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                {isImage && previewSrc ? (
                    <Avatar className="size-7 rounded-none">
                        <AvatarImage src={previewSrc} alt={name} className="object-cover" />
                        <AvatarFallback>
                            <FileTextIcon className="text-muted-foreground size-4" />
                        </AvatarFallback>
                    </Avatar>
                ) : (
                    <FileTextIcon className="text-muted-foreground size-4" />
                )}
            </div>
            <span className="text-foreground min-w-0 truncate text-sm">{name}</span>
            {onRemove && (
                <IconButton
                    tooltip="Remove file"
                    side="top"
                    className="size-6 shrink-0 rounded-full [&_svg]:size-3"
                    onClick={onRemove}
                >
                    <XIcon />
                </IconButton>
            )}
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        AttachmentCard: typeof AttachmentCard;
    }
}
