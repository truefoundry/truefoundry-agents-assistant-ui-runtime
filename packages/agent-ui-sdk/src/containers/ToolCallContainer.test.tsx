// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { ThreadPrimitive, type ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it, vi } from "vitest";

import { RuntimeHarness } from "./RuntimeHarness.js";
import { AssistantMessageContainer } from "./AssistantMessageContainer.js";

function renderToolCallMessage(content: ThreadMessageLike["content"]) {
    const message: ThreadMessageLike = { role: "assistant", content };
    return render(
        <RuntimeHarness messages={[message]}>
            <ThreadPrimitive.Messages>{() => <AssistantMessageContainer />}</ThreadPrimitive.Messages>
        </RuntimeHarness>,
    );
}

/** Pending approvals only surface part-level "requires-action" when the whole message is flagged too. */
function renderPendingApprovalMessage(
    content: ThreadMessageLike["content"],
    options?: { onRespondToToolApproval?: (o: unknown) => void },
) {
    const message: ThreadMessageLike = {
        role: "assistant",
        content,
        status: { type: "requires-action", reason: "tool-calls" },
    };
    return render(
        <RuntimeHarness
            messages={[message]}
            onRespondToToolApproval={options?.onRespondToToolApproval}
        >
            <ThreadPrimitive.Messages>{() => <AssistantMessageContainer />}</ThreadPrimitive.Messages>
        </RuntimeHarness>,
    );
}

describe("ToolCallContainer", () => {
    it("renders a running tool call without a result", () => {
        renderToolCallMessage([{ type: "tool-call", toolCallId: "1", toolName: "search_docs", args: {} }]);
        expect(screen.getByText("search_docs")).toBeInTheDocument();
        expect(screen.queryByText("Result:")).not.toBeInTheDocument();
    });

    it("renders args and result for a completed tool call once expanded", () => {
        renderToolCallMessage([
            {
                type: "tool-call",
                toolCallId: "1",
                toolName: "get_current_datetime",
                args: {},
                argsText: '{"tz":"UTC"}',
                result: "2026-07-01T00:00:00Z",
            },
        ]);
        fireEvent.click(screen.getByText("get_current_datetime"));
        expect(screen.getByText('{"tz":"UTC"}')).toBeInTheDocument();
        expect(screen.getByText("2026-07-01T00:00:00Z")).toBeInTheDocument();
    });

    it("renders an error result once expanded", () => {
        renderToolCallMessage([
            {
                type: "tool-call",
                toolCallId: "1",
                toolName: "flaky_tool",
                args: {},
                result: "boom",
                isError: true,
            },
        ]);
        fireEvent.click(screen.getByText("flaky_tool"));
        const result = screen.getByText("boom");
        expect(result).toBeInTheDocument();
        expect(result).toHaveClass("text-destructive");
    });

    it("auto-expands and shows the approval bar while an approval is pending", () => {
        renderPendingApprovalMessage([
            {
                type: "tool-call",
                toolCallId: "1",
                toolName: "delete_file",
                args: {},
                interrupt: { type: "human", payload: {} },
                approval: { id: "approval-1", approved: undefined },
            },
        ]);
        expect(screen.getByRole("button", { name: "Allow" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Deny" })).toBeInTheDocument();
    });

    it("calls onRespondToToolApproval when Allow is clicked", () => {
        const onRespondToToolApproval = vi.fn();
        renderPendingApprovalMessage(
            [
                {
                    type: "tool-call",
                    toolCallId: "1",
                    toolName: "delete_file",
                    args: {},
                    interrupt: { type: "human", payload: {} },
                    approval: { id: "approval-1", approved: undefined },
                },
            ],
            { onRespondToToolApproval },
        );
        fireEvent.click(screen.getByRole("button", { name: "Allow" }));
        expect(onRespondToToolApproval).toHaveBeenCalledWith(
            expect.objectContaining({ approvalId: "approval-1", approved: true }),
        );
    });

    it("renders declared approval options with their labels", () => {
        renderPendingApprovalMessage([
            {
                type: "tool-call",
                toolCallId: "1",
                toolName: "run_migration",
                args: {},
                interrupt: { type: "human", payload: {} },
                approval: {
                    id: "approval-1",
                    approved: undefined,
                    options: [
                        { id: "opt-allow", kind: "allow-once" },
                        { id: "opt-deny", kind: "reject-once" },
                    ],
                },
            },
        ]);
        expect(screen.getByRole("button", { name: "Allow" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Deny" })).toBeInTheDocument();
    });
});
