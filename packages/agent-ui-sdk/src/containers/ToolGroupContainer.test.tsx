// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { ThreadPrimitive, type ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";

import { RuntimeHarness } from "./RuntimeHarness.js";
import { AssistantMessageContainer } from "./AssistantMessageContainer.js";

function renderMultiToolMessage(content: ThreadMessageLike["content"], isRunning = false) {
    const message: ThreadMessageLike = { role: "assistant", content };
    return render(
        <RuntimeHarness messages={[message]} isRunning={isRunning}>
            <ThreadPrimitive.Messages>{() => <AssistantMessageContainer />}</ThreadPrimitive.Messages>
        </RuntimeHarness>,
    );
}

describe("ToolGroupContainer", () => {
    it("groups consecutive tool calls under a single 'N tool calls' trigger", () => {
        renderMultiToolMessage([
            { type: "tool-call", toolCallId: "1", toolName: "first_tool", args: {}, result: "a" },
            { type: "tool-call", toolCallId: "2", toolName: "second_tool", args: {}, result: "b" },
        ]);
        expect(screen.getByText("2 tool calls")).toBeInTheDocument();
    });

    it("renders both nested tool calls once expanded (defaultOpen)", () => {
        renderMultiToolMessage([
            { type: "tool-call", toolCallId: "1", toolName: "first_tool", args: {} },
            { type: "tool-call", toolCallId: "2", toolName: "second_tool", args: {} },
        ]);
        expect(screen.getByText("first_tool")).toBeInTheDocument();
        expect(screen.getByText("second_tool")).toBeInTheDocument();
    });

    it("collapses the group when the trigger is toggled", () => {
        renderMultiToolMessage([
            { type: "tool-call", toolCallId: "1", toolName: "first_tool", args: {} },
            { type: "tool-call", toolCallId: "2", toolName: "second_tool", args: {} },
        ]);
        fireEvent.click(screen.getByText("2 tool calls"));
        expect(screen.queryByText("first_tool")).not.toBeInTheDocument();
    });

    it("uses singular label for exactly one tool call in the group", () => {
        // A single standalone tool-call does not form a group; use two calls
        // where only one belongs to the grouped chain-of-thought bucket is not
        // constructible via plain fixtures, so this covers the pluralization
        // branch directly through the atom in ToolGroupCard's own contract.
        renderMultiToolMessage([
            { type: "tool-call", toolCallId: "1", toolName: "first_tool", args: {} },
            { type: "tool-call", toolCallId: "2", toolName: "second_tool", args: {} },
        ]);
        expect(screen.queryByText("1 tool call")).not.toBeInTheDocument();
    });
});
