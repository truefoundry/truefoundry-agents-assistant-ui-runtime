import { PlusIcon } from "lucide-react";

import { IconButton, type IconButtonProps } from "./primitives/IconButton.js";

export type AttachmentPickerButtonProps = Omit<IconButtonProps, "tooltip" | "children">;

export function AttachmentPickerButton(props: AttachmentPickerButtonProps) {
    return (
        <IconButton tooltip="Add Attachment" variant="ghost" className="size-7 rounded-full p-1" {...props}>
            <PlusIcon className="size-4.5" />
        </IconButton>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        AttachmentPickerButton: typeof AttachmentPickerButton;
    }
}
