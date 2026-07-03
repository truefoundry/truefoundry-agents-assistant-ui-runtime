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

    it("renders a fenced sandbox_artifacts code block as a download button", () => {
        renderAssistantMessage([
            {
                role: "assistant",
                content: "Here is a downloadable file:\n\n```sandbox_artifacts\n[sample.js](/tmp/sample.js)\n```",
            },
        ]);
        expect(screen.getByRole("button", { name: /sample\.js/ })).toBeInTheDocument();
        expect(document.querySelector(".aui-code-header-root")).not.toBeInTheDocument();
    });

    it("renders multiple links inside a fenced sandbox_artifacts code block", () => {
        renderAssistantMessage([
            {
                role: "assistant",
                content: "```sandbox_artifact\n[a.js](/tmp/a.js)\n[b.js](/tmp/b.js)\n```",
            },
        ]);
        expect(screen.getByRole("button", { name: /a\.js/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /b\.js/ })).toBeInTheDocument();
    });

    it("renders a single sandbox_artifact link as a download button", () => {
        renderAssistantMessage([
            {
                role: "assistant",
                content: "sandbox_artifact [Download the pink dog SVG](/tmp/pink_dog.svg)",
            },
        ]);
        const button = screen.getByRole("button", { name: /Download the pink dog SVG/ });
        expect(button).toBeInTheDocument();
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("renders multiple sandbox_artifact links in one paragraph as separate buttons", () => {
        renderAssistantMessage([
            {
                role: "assistant",
                content:
                    "sandbox_artifact [Download A](/tmp/a.svg) [Download B](/tmp/b.svg)",
            },
        ]);
        expect(screen.getByRole("button", { name: /Download A/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Download B/ })).toBeInTheDocument();
    });

    it("renders two separate sandbox_artifact paragraphs as two independent lists", () => {
        renderAssistantMessage([
            {
                role: "assistant",
                content:
                    "sandbox_artifact [Download A](/tmp/a.svg)\n\nsandbox_artifact [Download B](/tmp/b.svg)",
            },
        ]);
        expect(screen.getByRole("button", { name: /Download A/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Download B/ })).toBeInTheDocument();
    });

    it("renders a plain paragraph without the token unaffected", () => {
        renderAssistantMessage([{ role: "assistant", content: "just a [link](/tmp/a.svg)" }]);
        expect(screen.getByRole("link", { name: "link" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /link/ })).not.toBeInTheDocument();
    });

    it("falls back to default paragraph rendering for a partial, unclosed artifact link mid-stream", () => {
        renderAssistantMessage([
            { role: "assistant", content: "sandbox_artifact [Download the pink dog SVG](/tmp/pin" },
        ]);
        expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
        expect(screen.getByText(/sandbox_artifact/)).toBeInTheDocument();
    });
});
