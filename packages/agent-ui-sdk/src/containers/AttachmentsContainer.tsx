"use client";

import { useEffect, useState } from "react";
import { ComposerPrimitive, useAui, useAuiState } from "@assistant-ui/react";

import { useSlot } from "../theme/SlotsProvider.js";

function ComposerAttachmentItem() {
    const AttachmentCard = useSlot("AttachmentCard");
    const AttachmentPreviewDialog = useSlot("AttachmentPreviewDialog");
    const aui = useAui();
    const name = useAuiState((s) => s.attachment.name);
    const contentType = useAuiState((s) => s.attachment.contentType);
    const isImage = useAuiState((s) => s.attachment.type === "image");
    const file = useAuiState((s) => ("file" in s.attachment ? s.attachment.file : undefined));
    const [previewSrc, setPreviewSrc] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!isImage || !file) {
            setPreviewSrc(undefined);
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        setPreviewSrc(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [isImage, file]);

    return (
        <AttachmentPreviewDialog previewSrc={previewSrc}>
            <AttachmentCard
                name={name}
                contentType={contentType}
                previewSrc={previewSrc}
                onRemove={() => void aui.attachment().remove()}
            />
        </AttachmentPreviewDialog>
    );
}

/**
 * Attachments forwarded to the gateway on send render only in the composer's
 * staging tray; the runtime's own README documents user-message bubbles as
 * text-only, so no message-side attachment rendering is implemented here.
 */
export function ComposerAttachmentsContainer() {
    return <ComposerPrimitive.Attachments>{() => <ComposerAttachmentItem />}</ComposerPrimitive.Attachments>;
}

export function ComposerAttachmentPickerContainer() {
    const AttachmentPickerButton = useSlot("AttachmentPickerButton");
    return (
        <ComposerPrimitive.AddAttachment asChild>
            <AttachmentPickerButton />
        </ComposerPrimitive.AddAttachment>
    );
}
