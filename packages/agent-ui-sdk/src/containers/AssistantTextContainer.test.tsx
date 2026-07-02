// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { ThreadPrimitive, type ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";

import { RuntimeHarness } from "./RuntimeHarness.js";
import { AssistantMessageContainer } from "./AssistantMessageContainer.js";

function renderAssistantMessage(messages: ThreadMessageLike[]) {
    return render(
        <RuntimeHarness messages={messages}>
            <ThreadPrimitive.Messages>{() => <AssistantMessageContainer />}</ThreadPrimitive.Messages>
        </RuntimeHarness>,
    );
}

describe("AssistantTextContainer", () => {
    it("renders markdown formatting from the live text part", () => {
        renderAssistantMessage([{ role: "assistant", content: "**bold** text" }]);
        const strong = screen.getByText("bold");
        expect(strong.tagName).toBe("STRONG");
    });

    it("renders plain streaming text as it grows", () => {
        renderAssistantMessage([{ role: "assistant", content: "partial toke" }]);
        expect(screen.getByText("partial toke")).toBeInTheDocument();
    });

    it("renders openui fenced blocks through OpenUIBlock instead of a code pre", () => {
        renderAssistantMessage([
            {
                role: "assistant",
                content: '```openui\nCard() { title: "Sales" }\n```',
            },
        ]);
        expect(screen.getByTestId("openui-renderer")).toHaveTextContent('Card() { title: "Sales" }');
        expect(document.querySelector(".aui-code-header-root")).not.toBeInTheDocument();
    });
});
