// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { ThreadPrimitive, type ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";

import { RuntimeHarness } from "./RuntimeHarness.js";
import { UserMessageContainer } from "./UserMessageContainer.js";

function renderUserMessage(messages: ThreadMessageLike[]) {
    return render(
        <RuntimeHarness messages={messages}>
            <ThreadPrimitive.Messages>{() => <UserMessageContainer />}</ThreadPrimitive.Messages>
        </RuntimeHarness>,
    );
}

describe("UserMessageContainer", () => {
    it("renders user text content through the Markdown atom", () => {
        renderUserMessage([{ role: "user", content: "what is the capital of France?" }]);
        expect(screen.getByText("what is the capital of France?")).toBeInTheDocument();
    });

    it("hides the branch indicator when there is only a single branch", () => {
        renderUserMessage([{ role: "user", content: "hi" }]);
        expect(screen.queryByText(/^\d+ \/ \d+$/)).not.toBeInTheDocument();
    });

    it("renders an image attachment preview above the text bubble", () => {
        renderUserMessage([
            {
                role: "user",
                content: "What is this?",
                attachments: [
                    {
                        id: "att-1",
                        type: "image",
                        name: "logo.png",
                        contentType: "image/png",
                        status: { type: "complete" },
                        content: [
                            {
                                type: "image",
                                image: "data:image/png;base64,iVBORw0KGgo=",
                                filename: "logo.png",
                            },
                        ],
                    },
                ],
            },
        ]);
        expect(screen.getByText("What is this?")).toBeInTheDocument();
        const preview = screen.getByAltText("logo.png");
        expect(preview).toBeInTheDocument();
        expect(preview.parentElement).toHaveStyle({ width: "12rem", height: "12rem" });
    });

    it("renders a file attachment chip above the text bubble", () => {
        renderUserMessage([
            {
                role: "user",
                content: "See attached",
                attachments: [
                    {
                        id: "att-1",
                        type: "file",
                        name: "report.pdf",
                        contentType: "application/pdf",
                        status: { type: "complete" },
                        content: [
                            {
                                type: "file",
                                mimeType: "application/pdf",
                                filename: "report.pdf",
                                data: "data:application/pdf;base64,AAAA",
                            },
                        ],
                    },
                ],
            },
        ]);
        expect(screen.getByText("See attached")).toBeInTheDocument();
        const chip = screen.getByText("report.pdf").closest("[data-slot='aui_attachment-chip']");
        expect(chip).toHaveStyle({ maxWidth: "12rem" });
    });
});
