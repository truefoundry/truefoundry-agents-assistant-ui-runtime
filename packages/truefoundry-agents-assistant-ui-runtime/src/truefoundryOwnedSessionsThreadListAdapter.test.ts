import { describe, expect, it, vi } from "vitest";

import type { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";

import { createTrueFoundryOwnedSessionsThreadListAdapter } from "./truefoundryOwnedSessionsThreadListAdapter.js";

function mockNamedSession(id: string, title: string, updatedAt: string) {
    return {
        type: "session" as const,
        id,
        agentName: "my-agent",
        title,
        createdBySubject: { type: "user" as const, id: "u1" },
        createdAt: updatedAt,
        updatedAt,
    };
}

function mockDraftSession(id: string, title: string | undefined, updatedAt: string) {
    return {
        type: "session/draft" as const,
        id,
        agentSpec: { model: { name: "anthropic/claude-sonnet-4-6" } },
        title,
        createdBySubject: { type: "user" as const, id: "u1" },
        createdAt: updatedAt,
        updatedAt,
    };
}

describe("createTrueFoundryOwnedSessionsThreadListAdapter", () => {
    it("lists owned sessions (named + draft) with pagination cursor", async () => {
        const listOwnedSessions = vi.fn().mockResolvedValue({
            data: [
                mockNamedSession("s1", "Named chat", "2026-06-30T12:00:00.000Z"),
                mockDraftSession("d1", "Draft chat", "2026-06-30T11:00:00.000Z"),
            ],
            response: {
                pagination: { nextPageToken: "page-2", limit: 20 },
            },
        });
        const privateClient = {
            listOwnedSessions,
            getDraftSession: vi.fn(),
        } as unknown as PrivateAgentSessionClient;

        const adapter = createTrueFoundryOwnedSessionsThreadListAdapter({ privateClient });
        const result = await adapter.list();

        expect(listOwnedSessions).toHaveBeenCalledWith(
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

    it("falls back to model name for untitled drafts", async () => {
        const listOwnedSessions = vi.fn().mockResolvedValue({
            data: [mockDraftSession("d1", undefined, "2026-06-30T11:00:00.000Z")],
            response: { pagination: { limit: 20 } },
        });
        const privateClient = {
            listOwnedSessions,
            getDraftSession: vi.fn(),
        } as unknown as PrivateAgentSessionClient;

        const adapter = createTrueFoundryOwnedSessionsThreadListAdapter({ privateClient });
        const result = await adapter.list();

        expect(result.threads[0]?.title).toBe("anthropic/claude-sonnet-4-6");
    });

    it("throws on initialize because the adapter is read-only", async () => {
        const privateClient = {
            listOwnedSessions: vi.fn(),
            getDraftSession: vi.fn(),
        } as unknown as PrivateAgentSessionClient;

        const adapter = createTrueFoundryOwnedSessionsThreadListAdapter({ privateClient });

        await expect(adapter.initialize("local")).rejects.toThrow(/read-only/);
    });
});
