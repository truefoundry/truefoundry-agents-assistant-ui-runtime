import type { CompleteAttachment } from "@assistant-ui/core";
import type {
    ModelMessageEvent,
    TurnEvent,
    TurnStreamingEvent,
} from "truefoundry-gateway-sdk/agents";
import { isEventDelta, mergeEventDelta } from "truefoundry-gateway-sdk/agents";

import type { AssistantContentPart } from "./modelMessageContent.js";

export type ImageUrlContentPart = {
    type: "image_url";
    image_url: { url: string };
};

type ModelMessageContentPart =
    | { type: "text"; text: string }
    | { type: "refusal"; refusal: string }
    | ImageUrlContentPart;

type ContentBlockDelta = {
    index: number;
    delta:
        | { type: "text"; text?: string }
        | { type: "image_url"; image_url?: { url?: string } };
};

type ModelMessageDeltaWithContentBlocks = {
    type: "model.message.delta";
    id: string;
    contentBlocks?: ContentBlockDelta[];
    content_blocks?: ContentBlockDelta[];
};

function parseDataUriMime(data: string): string {
    if (!data.startsWith("data:")) {
        return "image/png";
    }
    const match = /^data:([^;,]+)/.exec(data);
    return match?.[1] ?? "image/png";
}

function imageFilenameFromUrl(url: string, index: number): string {
    const mimeType = parseDataUriMime(url);
    const ext = mimeType.split("/")[1] ?? "png";
    return `image-${index + 1}.${ext}`;
}

export function isImageUrlContentPart(
    part: unknown,
): part is ImageUrlContentPart {
    return (
        part != null &&
        typeof part === "object" &&
        (part as ImageUrlContentPart).type === "image_url" &&
        typeof (part as ImageUrlContentPart).image_url?.url === "string"
    );
}

function normalizeModelMessageContent(
    message: ModelMessageEvent,
): ModelMessageContentPart[] {
    const { content } = message;
    if (content == null) {
        return [];
    }
    if (typeof content === "string") {
        return content.length > 0 ? [{ type: "text", text: content }] : [];
    }
    return content as ModelMessageContentPart[];
}

function ensureModelMessageContentArray(message: ModelMessageEvent): void {
    if (Array.isArray(message.content)) {
        return;
    }
    message.content = normalizeModelMessageContent(message);
}

function mergeContentBlockDeltas(
    message: ModelMessageEvent,
    blocks: readonly ContentBlockDelta[],
): void {
    ensureModelMessageContentArray(message);
    const content = message.content as ModelMessageContentPart[];

    for (const block of blocks) {
        const index = block.index;
        while (content.length <= index) {
            content.push({ type: "text", text: "" });
        }

        const delta = block.delta;
        if (delta.type === "text") {
            const existing = content[index];
            if (existing?.type === "text") {
                existing.text += delta.text ?? "";
            } else {
                content[index] = { type: "text", text: delta.text ?? "" };
            }
            continue;
        }

        if (delta.type !== "image_url") {
            continue;
        }

        const chunk = delta.image_url?.url ?? "";
        const existing = content[index];
        if (isImageUrlContentPart(existing)) {
            existing.image_url.url += chunk;
        } else {
            content[index] = { type: "image_url", image_url: { url: chunk } };
        }
    }
}

export function mergeStreamEventDelta(
    base: TurnEvent,
    delta: TurnStreamingEvent,
): void {
    if (!isEventDelta(delta)) {
        return;
    }

    mergeEventDelta(base, delta);

    if (base.type !== "model.message" || delta.type !== "model.message.delta") {
        return;
    }

    const extended = delta as ModelMessageDeltaWithContentBlocks;
    const blocks = extended.contentBlocks ?? extended.content_blocks;
    if (blocks == null || blocks.length === 0) {
        return;
    }

    mergeContentBlockDeltas(base, blocks);
}

export function imageUrlToAttachment(
    url: string,
    attachmentId: string,
): CompleteAttachment {
    const mimeType = parseDataUriMime(url);
    return {
        id: attachmentId,
        type: "image",
        name: imageFilenameFromUrl(url, 0),
        contentType: mimeType,
        status: { type: "complete" },
        content: [{ type: "image", image: url, filename: imageFilenameFromUrl(url, 0) }],
    };
}

export function imagePartToAssistantImage(url: string, index: number): AssistantContentPart {
    return {
        type: "image",
        image: url,
        filename: imageFilenameFromUrl(url, index),
    };
}

export function extractImagePartsFromModelMessage(
    message: ModelMessageEvent,
): AssistantContentPart[] {
    const parts: AssistantContentPart[] = [];
    let imageIndex = 0;

    for (const part of normalizeModelMessageContent(message)) {
        if (!isImageUrlContentPart(part)) {
            continue;
        }
        const url = part.image_url.url.trim();
        if (url.length === 0) {
            continue;
        }
        parts.push(imagePartToAssistantImage(url, imageIndex));
        imageIndex += 1;
    }

    return parts;
}

export function extractImageUrlFromUserContentItem(
    part: unknown,
): string | undefined {
    if (isImageUrlContentPart(part)) {
        const url = part.image_url.url.trim();
        return url.length > 0 ? url : undefined;
    }
    return undefined;
}