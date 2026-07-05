// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import {
    AssistantRuntimeProvider,
    useExternalStoreRuntime,
    type ThreadMessageLike,
} from "@assistant-ui/react";
import { trueFoundryExtras, type TrueFoundryRuntimeExtras } from "truefoundry-agents-assistant-ui-runtime";
import { describe, expect, it, vi } from "vitest";

import { McpAuthContainer } from "./McpAuthContainer.js";

const SERVERS = [
    { id: "srv-1", name: "github", authUrl: "https://example.com/auth/github" },
    { id: "srv-2", name: "slack", authUrl: "https://example.com/auth/slack" },
];
const PENDING = { mcpServers: SERVERS };

function McpAuthHarness({
    pendingMcpAuth,
    resumeMcpAuth,
    isRunning = false,
}: {
    pendingMcpAuth: TrueFoundryRuntimeExtras["pendingMcpAuth"];
    resumeMcpAuth: TrueFoundryRuntimeExtras["resumeMcpAuth"];
    isRunning?: boolean;
}) {
    const messages: ThreadMessageLike[] = [];
    const runtime = useExternalStoreRuntime({
        messages,
        isRunning,
        convertMessage: (m: ThreadMessageLike) => m,
        onNew: async () => {},
        extras: trueFoundryExtras.provide({
            pendingApprovals: [],
            pendingToolResponses: [],
            pendingMcpAuth,
            sandboxId: undefined,
            respondToToolApproval: () => {},
            respondToToolResponse: () => {},
            resumeMcpAuth,
            downloadSandboxFile: async () => new Blob(),
            cancel: async () => {},
            resetFromTurn: async () => {},
            draft: null,
        }),
    });

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <McpAuthContainer />
        </AssistantRuntimeProvider>
    );
}

describe("McpAuthContainer", () => {
    it("renders nothing when there is no pending MCP auth", () => {
        render(<McpAuthHarness pendingMcpAuth={null} resumeMcpAuth={vi.fn()} />);
        expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
    });

    it("renders a real Connect link per server", () => {
        render(
            <McpAuthHarness
                pendingMcpAuth={PENDING}
                resumeMcpAuth={vi.fn().mockResolvedValue(undefined)}
            />,
        );
        expect(screen.getByText("github")).toBeInTheDocument();
        expect(screen.getByText("slack")).toBeInTheDocument();

        const connectLinks = screen.getAllByRole("link", { name: /connect/i });
        expect(connectLinks).toHaveLength(2);
        expect(connectLinks.map((link) => link.getAttribute("href"))).toEqual([
            "https://example.com/auth/github",
            "https://example.com/auth/slack",
        ]);
        for (const link of connectLinks) {
            expect(link).toHaveAttribute("target", "_blank");
            expect(link).toHaveAttribute("rel", "noopener noreferrer");
        }
    });

    it("calls resume when Continue is clicked", () => {
        const resumeMcpAuth = vi.fn().mockResolvedValue(undefined);
        render(
            <McpAuthHarness pendingMcpAuth={PENDING} resumeMcpAuth={resumeMcpAuth} isRunning={false} />,
        );

        fireEvent.click(screen.getByRole("button", { name: /continue/i }));
        expect(resumeMcpAuth).toHaveBeenCalledTimes(1);
    });

    it("disables Continue while the thread is running", () => {
        render(
            <McpAuthHarness pendingMcpAuth={PENDING} resumeMcpAuth={vi.fn()} isRunning={true} />,
        );
        expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    });
});
