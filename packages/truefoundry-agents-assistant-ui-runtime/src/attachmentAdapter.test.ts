import { describe, expect, it } from "vitest";
import type { PendingAttachment } from "@assistant-ui/core";

import { agentAttachmentAdapter } from "./attachmentAdapter.js";

async function addFile(file: File): Promise<PendingAttachment> {
    const result = await agentAttachmentAdapter.add({ file });
    if (Symbol.asyncIterator in result) {
        throw new Error("expected PendingAttachment");
    }
    return result;
}

describe("agentAttachmentAdapter", () => {
    it("accepts all file types", () => {
        expect(agentAttachmentAdapter.accept).toBe("*");
    });

    it("add returns a pending attachment awaiting composer send", async () => {
        const file = new File(["hello"], "notes.txt", { type: "text/plain" });
        const pending = await addFile(file);

        expect(pending).toMatchObject({
            type: "file",
            name: "notes.txt",
            contentType: "text/plain",
            file,
            content: [],
            status: { type: "requires-action", reason: "composer-send" },
        });
        expect(pending.id).toBeTruthy();
    });

    it("send reads the file into a data URI file part", async () => {
        const file = new File(["hello"], "notes.txt", { type: "text/plain" });
        const pending = await addFile(file);
        const complete = await agentAttachmentAdapter.send(pending);

        expect(complete.status).toEqual({ type: "complete" });
        expect(complete.content).toHaveLength(1);
        expect(complete.content[0]).toMatchObject({
            type: "file",
            mimeType: "text/plain",
            filename: "notes.txt",
        });
        expect(complete.content[0]).toMatchObject({
            data: expect.stringMatching(/^data:text\/plain;base64,/),
        });
    });

    it("remove is a no-op", async () => {
        const file = new File(["hello"], "notes.txt", { type: "text/plain" });
        const pending = await addFile(file);
        await expect(agentAttachmentAdapter.remove(pending)).resolves.toBeUndefined();
    });
});
