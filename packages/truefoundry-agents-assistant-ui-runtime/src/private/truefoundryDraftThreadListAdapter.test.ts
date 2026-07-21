import { describe, expect, it, vi } from "vitest";

import type { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";

import { createTrueFoundryDraftThreadListAdapter } from "./truefoundryDraftThreadListAdapter.js";
import type { AgentSpec } from "./agentSpec.js";

const defaultAgentSpec: AgentSpec = {
    model: { name: "anthropic/claude-sonnet-4-6" },
    instructions: "You are helpful.",
};

function mockDraft(id: string, title: string | undefined, updatedAt: string) {
    return {
        type: "session/draft" as const,
        id,
        agentSpec: defaultAgentSpec,
        title,
        createdBySubject: { type: "user" as const, id: "u1" },
        createdAt: updatedAt,
        updatedAt,
    };
}

function mockDraftListPage(
    drafts: ReturnType<typeof mockDraft>[],
    nextPageToken?: string,
) {
    return {
        data: drafts,
        response: {
            pagination: {
                nextPageToken,
                limit: 20,
            },
        },
    };
}

describe("createTrueFoundryDraftThreadListAdapter", () => {
    it("lists draft sessions with pagination cursor", async () => {
        const listDraftSessions = vi.fn().mockResolvedValue(
            mockDraftListPage(
                [mockDraft("d1", "My draft", "2026-06-30T10:00:00.000Z")],
                "page-2",
            ),
        );
        const privateClient = {
            listDraftSessions,
            createDraftSession: vi.fn(),
            getDraftSession: vi.fn(),
        } as unknown as PrivateAgentSessionClient;

        const adapter = createTrueFoundryDraftThreadListAdapter({
            privateClient,
            defaultAgentSpec,
        });

        const result = await adapter.list();

        expect(listDraftSessions).toHaveBeenCalledWith(
            expect.objectContaining({
                limit: 20,
                pageToken: undefined,
                startTimestamp: expect.any(String),
            }),
        );
        expect(listDraftSessions).toHaveBeenCalledWith(
            expect.not.objectContaining({ agentName: expect.anything() }),
        );
        expect(result.threads).toEqual([
            {
                status: "regular",
                remoteId: "d1",
                title: "My draft",
                lastMessageAt: new Date("2026-06-30T10:00:00.000Z"),
            },
        ]);
        expect(result.nextCursor).toBe("page-2");
    });

    it("creates a draft session on initialize", async () => {
        const createDraftSession = vi.fn().mockResolvedValue(
            mockDraft("d-new", undefined, "2026-06-30T12:00:00.000Z"),
        );
        const privateClient = {
            listDraftSessions: vi.fn(),
            createDraftSession,
            getDraftSession: vi.fn(),
        } as unknown as PrivateAgentSessionClient;

        const adapter = createTrueFoundryDraftThreadListAdapter({
            privateClient,
            defaultAgentSpec,
        });

        const result = await adapter.initialize("local-thread-id");

        expect(createDraftSession).toHaveBeenCalledWith({ agentSpec: defaultAgentSpec });
        expect(result).toEqual({ remoteId: "d-new", externalId: undefined });
    });

    it("creates a draft session with the live agent spec when getAgentSpec is provided", async () => {
        const liveAgentSpec: AgentSpec = {
            model: { name: "anthropic/claude-opus-4-8" },
            instructions: "You are helpful.",
            mcpServers: [{ name: "github", enableTools: ["@all"] }],
            skills: [{ fqn: "acme/skill-a:1", preload: false }],
        };
        const createDraftSession = vi.fn().mockResolvedValue(
            mockDraft("d-new", undefined, "2026-06-30T12:00:00.000Z"),
        );
        const privateClient = {
            listDraftSessions: vi.fn(),
            createDraftSession,
            getDraftSession: vi.fn(),
        } as unknown as PrivateAgentSessionClient;

        const adapter = createTrueFoundryDraftThreadListAdapter({
            privateClient,
            defaultAgentSpec,
            getAgentSpec: () => liveAgentSpec,
        });

        await adapter.initialize("local-thread-id");

        expect(createDraftSession).toHaveBeenCalledWith({ agentSpec: liveAgentSpec });
    });

    it("falls back to model name for title when draft has no title", async () => {
        const getDraftSession = vi.fn().mockResolvedValue(
            mockDraft("d1", undefined, "2026-06-30T10:00:00.000Z"),
        );
        const privateClient = {
            listDraftSessions: vi.fn(),
            createDraftSession: vi.fn(),
            getDraftSession,
        } as unknown as PrivateAgentSessionClient;

        const adapter = createTrueFoundryDraftThreadListAdapter({
            privateClient,
            defaultAgentSpec,
        });

        const result = await adapter.fetch("d1");

        expect(getDraftSession).toHaveBeenCalledWith({ draftSessionId: "d1" });
        expect(result.title).toBe("anthropic/claude-sonnet-4-6");
    });
});
