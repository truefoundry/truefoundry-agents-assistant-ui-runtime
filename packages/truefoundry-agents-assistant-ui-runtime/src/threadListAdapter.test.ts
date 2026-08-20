import { describe, expect, it, vi } from "vitest";

import type { AgentChatServer, Session } from "./server/index.js";

import { createThreadListAdapter } from "./threadListAdapter.js";

function mockSession(
    id: string,
    title: string,
    updatedAt: string,
    agentName?: string,
): Session {
    return {
        id,
        title,
        updatedAt,
        createdAt: updatedAt,
        isMutable: false,
        ...(agentName != null ? { agentName } : {}),
    };
}

function mockListSessionsPage(sessions: Session[], nextPageToken?: string) {
    return {
        data: sessions,
        ...(nextPageToken != null ? { nextPageToken } : {}),
    };
}

function mockServer(partial: Partial<AgentChatServer>): AgentChatServer {
    return partial as AgentChatServer;
}

describe("createThreadListAdapter", () => {
    it("lists the first page without agentId when filter is omitted", async () => {
        const listSessions = vi.fn().mockResolvedValue(
            mockListSessionsPage(
                [mockSession("s1", "First", "2026-06-30T10:00:00.000Z", "my-agent")],
                "page-2",
            ),
        );
        const server = mockServer({ listSessions });
        const adapter = createThreadListAdapter({
            server,
            agentName: "my-agent",
        });

        const result = await adapter.list();

        expect(listSessions).toHaveBeenCalledWith(
            expect.objectContaining({
                limit: 20,
                pageToken: undefined,
                startTimestamp: expect.any(String),
            }),
        );
        expect(listSessions.mock.calls[0]?.[0]).not.toHaveProperty("agentId");
        expect(result.threads).toEqual([
            {
                status: "regular",
                remoteId: "s1",
                title: "First",
                lastMessageAt: new Date("2026-06-30T10:00:00.000Z"),
                custom: { isMutable: false, agentName: "my-agent" },
            },
        ]);
        expect(result.nextCursor).toBe("page-2");
    });

    it("forwards listSessionsAgentId as agentId", async () => {
        const listSessions = vi.fn().mockResolvedValue(
            mockListSessionsPage([mockSession("s2", "Second", "2026-06-29T10:00:00.000Z")]),
        );
        const server = mockServer({ listSessions });
        const adapter = createThreadListAdapter({
            server,
            agentName: "my-agent",
            listSessionsAgentId: "filter-agent",
        });

        const result = await adapter.list({ after: "page-2" });

        expect(listSessions).toHaveBeenCalledWith(
            expect.objectContaining({
                agentId: "filter-agent",
                limit: 20,
                pageToken: "page-2",
            }),
        );
        expect(result.nextCursor).toBeUndefined();
    });

    it("omits nextCursor when the backend returns no next page token", async () => {
        const listSessions = vi.fn().mockResolvedValue(
            mockListSessionsPage([mockSession("s1", "Only", "2026-06-30T10:00:00.000Z")]),
        );
        const server = mockServer({ listSessions });
        const adapter = createThreadListAdapter({
            server,
            agentName: "my-agent",
        });

        const result = await adapter.list();

        expect(result.nextCursor).toBeUndefined();
    });

    it("delete calls server.deleteSession when implemented", async () => {
        const deleteSession = vi.fn().mockResolvedValue(undefined);
        const server = mockServer({ deleteSession });
        const adapter = createThreadListAdapter({
            server,
            agentName: "my-agent",
        });

        await adapter.delete("s1");

        expect(deleteSession).toHaveBeenCalledWith({ sessionId: "s1" });
    });

    it("delete is a no-op when server.deleteSession is missing", async () => {
        const adapter = createThreadListAdapter({
            server: mockServer({}),
            agentName: "my-agent",
        });

        await expect(adapter.delete("s1")).resolves.toBeUndefined();
    });
});
