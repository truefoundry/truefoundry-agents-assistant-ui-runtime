import { describe, expect, it, vi } from "vitest";

import type { AgentSessionClient } from "truefoundry-gateway-sdk/agents";

import { createTrueFoundryThreadListAdapter } from "./truefoundryThreadListAdapter.js";

function mockSession(id: string, title: string, updatedAt: string) {
    return {
        id,
        title,
        updatedAt,
    };
}

function mockListSessionsPage(
    sessions: ReturnType<typeof mockSession>[],
    nextPageToken?: string,
) {
    return {
        data: sessions,
        response: {
            pagination: {
                nextPageToken,
                limit: 20,
            },
        },
    };
}

describe("createTrueFoundryThreadListAdapter", () => {
    it("lists the first page with limit and returns nextCursor", async () => {
        const listSessions = vi.fn().mockResolvedValue(
            mockListSessionsPage(
                [mockSession("s1", "First", "2026-06-30T10:00:00.000Z")],
                "page-2",
            ),
        );
        const client = { listSessions } as unknown as AgentSessionClient;
        const adapter = createTrueFoundryThreadListAdapter({
            client,
            agentName: "my-agent",
        });

        const result = await adapter.list();

        expect(listSessions).toHaveBeenCalledWith(
            expect.objectContaining({
                agentName: "my-agent",
                limit: 20,
                pageToken: undefined,
                startTimestamp: expect.any(String),
            }),
        );
        expect(result.threads).toEqual([
            {
                status: "regular",
                remoteId: "s1",
                title: "First",
                lastMessageAt: new Date("2026-06-30T10:00:00.000Z"),
            },
        ]);
        expect(result.nextCursor).toBe("page-2");
    });

    it("forwards after as pageToken for subsequent pages", async () => {
        const listSessions = vi.fn().mockResolvedValue(
            mockListSessionsPage(
                [mockSession("s2", "Second", "2026-06-29T10:00:00.000Z")],
            ),
        );
        const client = { listSessions } as unknown as AgentSessionClient;
        const adapter = createTrueFoundryThreadListAdapter({
            client,
            agentName: "my-agent",
        });

        const result = await adapter.list({ after: "page-2" });

        expect(listSessions).toHaveBeenCalledWith(
            expect.objectContaining({
                agentName: "my-agent",
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
        const client = { listSessions } as unknown as AgentSessionClient;
        const adapter = createTrueFoundryThreadListAdapter({
            client,
            agentName: "my-agent",
        });

        const result = await adapter.list();

        expect(result.nextCursor).toBeUndefined();
    });
});
