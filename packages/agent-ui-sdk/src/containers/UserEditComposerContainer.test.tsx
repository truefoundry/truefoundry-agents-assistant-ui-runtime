// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { ThreadPrimitive, type ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";

import { RuntimeHarness } from "./RuntimeHarness.js";
import { UserEditComposerContainer } from "./UserEditComposerContainer.js";

function renderEditComposer(messages: ThreadMessageLike[]) {
    return render(
        <RuntimeHarness messages={messages}>
            <ThreadPrimitive.Messages>{() => <UserEditComposerContainer />}</ThreadPrimitive.Messages>
        </RuntimeHarness>,
    );
}

describe("UserEditComposerContainer", () => {
    it("renders a text input with cancel and send actions", () => {
        renderEditComposer([{ role: "user", content: "edit me", id: "turn-1-user" }]);
        expect(screen.getByRole("textbox")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    });

    it("shows read-only attachments without remove controls", () => {
        renderEditComposer([
            {
                role: "user",
                content: "What is this?",
                id: "turn-1-user",
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
        expect(screen.getByAltText("logo.png")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
    });
});
