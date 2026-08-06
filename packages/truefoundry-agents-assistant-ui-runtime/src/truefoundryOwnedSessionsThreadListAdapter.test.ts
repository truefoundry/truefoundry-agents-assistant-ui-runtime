import { describe, expect, it, vi } from "vitest";

import type { AgentChatServer, Session } from "./server/index.js";

import { createTrueFoundryOwnedSessionsThreadListAdapter } from "./truefoundryOwnedSessionsThreadListAdapter.js";

function mockNamedSession(id: string, title: string, updatedAt: string): Session {
    return {
        id,
        agentName: "my-agent",
        title,
        createdAt: updatedAt,
        updatedAt,
        isMutable: false,
    };
}

function mockDraftSession(
    id: string,
    title: string | undefined,
    updatedAt: string,
): Session {
    return {
        id,
        agentSpec: { model: { name: "anthropic/claude-sonnet-4-6" } },
        title,
        createdAt: updatedAt,
        updatedAt,
        isMutable: true,
    };
}

function mockServer(partial: Partial<AgentChatServer>): AgentChatServer {
    return partial as AgentChatServer;
}

describe("createTrueFoundryOwnedSessionsThreadListAdapter", () => {
    it("lists owned sessions (named + draft) with pagination cursor", async () => {
        const listSessions = vi.fn().mockResolvedValue({
            data: [
                mockNamedSession("s1", "Named chat", "2026-06-30T12:00:00.000Z"),
                mockDraftSession("d1", "Draft chat", "2026-06-30T11:00:00.000Z"),
            ],
            nextPageToken: "page-2",
        });
        const server = mockServer({ listSessions, getSession: vi.fn() });

        const adapter = createTrueFoundryOwnedSessionsThreadListAdapter({ server });
        const result = await adapter.list();

        expect(listSessions).toHaveBeenCalledWith(
            expect.objectContaining({
                limit: 20,
                pageToken: undefined,
                startTimestamp: expect.any(String),
            }),
        );
        expect(result.threads).toEqual([
            {
                status: "regular",
                remoteId: "s1",
                title: "Named chat",
                lastMessageAt: new Date("2026-06-30T12:00:00.000Z"),
                custom: { agentName: "my-agent" },
            },
            {
                status: "regular",
                remoteId: "d1",
                title: "Draft chat",
                lastMessageAt: new Date("2026-06-30T11:00:00.000Z"),
            },
        ]);
        expect(result.nextCursor).toBe("page-2");
    });

    it("forwards listSessionsAgentId as agentId", async () => {
        const listSessions = vi.fn().mockResolvedValue({ data: [] });
        const server = mockServer({ listSessions, getSession: vi.fn() });

        const adapter = createTrueFoundryOwnedSessionsThreadListAdapter({
            server,
            listSessionsAgentId: "agent-x",
        });
        await adapter.list();

        expect(listSessions).toHaveBeenCalledWith(
            expect.objectContaining({ agentId: "agent-x" }),
        );
    });

    it("falls back to model name for untitled drafts", async () => {
        const listSessions = vi.fn().mockResolvedValue({
            data: [mockDraftSession("d1", undefined, "2026-06-30T11:00:00.000Z")],
        });
        const server = mockServer({ listSessions, getSession: vi.fn() });

        const adapter = createTrueFoundryOwnedSessionsThreadListAdapter({ server });
        const result = await adapter.list();

        expect(result.threads[0]?.title).toBe("anthropic/claude-sonnet-4-6");
    });

    it("throws on initialize because the adapter is read-only", async () => {
        const server = mockServer({
            listSessions: vi.fn(),
            getSession: vi.fn(),
        });

        const adapter = createTrueFoundryOwnedSessionsThreadListAdapter({ server });

        await expect(adapter.initialize("local")).rejects.toThrow(/read-only/);
    });
});
