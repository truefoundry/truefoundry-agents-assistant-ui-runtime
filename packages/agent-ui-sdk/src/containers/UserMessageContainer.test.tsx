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
});
