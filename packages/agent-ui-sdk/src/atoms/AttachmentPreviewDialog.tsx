import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./primitives/Dialog.js";

export type AttachmentPreviewDialogProps = {
    previewSrc?: string;
    children: ReactNode;
};

export function AttachmentPreviewDialog({ previewSrc, children }: AttachmentPreviewDialogProps) {
    if (!previewSrc) return <>{children}</>;

    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="p-2 sm:max-w-3xl">
                <DialogTitle className="sr-only">Image Attachment Preview</DialogTitle>
                <div className="bg-background relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden">
                    <img
                        src={previewSrc}
                        alt="Attachment preview"
                        className="block h-auto max-h-[80vh] w-auto max-w-full object-contain"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        AttachmentPreviewDialog: typeof AttachmentPreviewDialog;
    }
}
