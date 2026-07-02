import { FileTextIcon, XIcon } from "lucide-react";

import { cn } from "./lib/cn.js";
import { Avatar, AvatarFallback, AvatarImage } from "./primitives/Avatar.js";
import { IconButton } from "./primitives/IconButton.js";

export type AttachmentCardProps = {
    name: string;
    contentType?: string;
    previewSrc?: string;
    onRemove?: () => void;
    className?: string;
};

export function AttachmentCard({ name, previewSrc, onRemove, className }: AttachmentCardProps) {
    return (
        <div
            data-slot="aui_attachment-tile"
            className={cn(
                "aui-attachment-tile bg-muted relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border",
                className,
            )}
        >
            <Avatar className="h-full w-full rounded-none">
                {previewSrc && <AvatarImage src={previewSrc} alt={name} className="object-cover" />}
                <AvatarFallback>
                    <FileTextIcon className="text-muted-foreground size-8" />
                </AvatarFallback>
            </Avatar>
            {onRemove && (
                <IconButton
                    tooltip="Remove file"
                    side="top"
                    className="absolute end-1.5 top-1.5 size-3.5 rounded-full bg-white shadow-sm [&_svg]:text-black"
                    onClick={onRemove}
                >
                    <XIcon className="size-3" />
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
