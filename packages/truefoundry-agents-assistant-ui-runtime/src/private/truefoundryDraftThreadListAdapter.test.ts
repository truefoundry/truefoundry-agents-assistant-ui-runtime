import { describe, expect, it, vi } from "vitest";

import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";

import { createTrueFoundryDraftThreadListAdapter } from "./truefoundryDraftThreadListAdapter.js";
import type { AgentSpec } from "./agentSpec.js";

const defaultAgentSpec: AgentSpec = {
    model: { name: "anthropic/claude-sonnet-4-6" },
    instructions: "You are helpful.",
};

function mockDraft(id: string, title: string | undefined, updatedAt: string) {
    return {
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
        const list = vi.fn().mockResolvedValue(
            mockDraftListPage(
                [mockDraft("d1", "My draft", "2026-06-30T10:00:00.000Z")],
                "page-2",
            ),
        );
        const gateway = {
            agents: { private: { draftSessions: { list, create: vi.fn(), get: vi.fn() } } },
        } as unknown as TrueFoundryGateway;

        const adapter = createTrueFoundryDraftThreadListAdapter({
            gateway,
            defaultAgentSpec,
        });

        const result = await adapter.list();

        expect(list).toHaveBeenCalledWith(
            expect.objectContaining({
                limit: 20,
                pageToken: undefined,
                startTimestamp: expect.any(String),
            }),
        );
        expect(list).toHaveBeenCalledWith(
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
        const create = vi.fn().mockResolvedValue({
            data: mockDraft("d-new", undefined, "2026-06-30T12:00:00.000Z"),
        });
        const gateway = {
            agents: { private: { draftSessions: { list: vi.fn(), create, get: vi.fn() } } },
        } as unknown as TrueFoundryGateway;

        const adapter = createTrueFoundryDraftThreadListAdapter({
            gateway,
            defaultAgentSpec,
        });

        const result = await adapter.initialize("local-thread-id");

        expect(create).toHaveBeenCalledWith({ agentSpec: defaultAgentSpec });
        expect(result).toEqual({ remoteId: "d-new", externalId: undefined });
    });

    it("creates a draft session with the live agent spec when getAgentSpec is provided", async () => {
        const liveAgentSpec: AgentSpec = {
            model: { name: "anthropic/claude-opus-4-8" },
            instructions: "You are helpful.",
            mcpServers: [{ name: "github", enableTools: ["@all"] }],
            skills: [{ fqn: "acme/skill-a:1", preload: false }],
        };
        const create = vi.fn().mockResolvedValue({
            data: mockDraft("d-new", undefined, "2026-06-30T12:00:00.000Z"),
        });
        const gateway = {
            agents: { private: { draftSessions: { list: vi.fn(), create, get: vi.fn() } } },
        } as unknown as TrueFoundryGateway;

        const adapter = createTrueFoundryDraftThreadListAdapter({
            gateway,
            defaultAgentSpec,
            getAgentSpec: () => liveAgentSpec,
        });

        await adapter.initialize("local-thread-id");

        expect(create).toHaveBeenCalledWith({ agentSpec: liveAgentSpec });
    });

    it("falls back to model name for title when draft has no title", async () => {
        const get = vi.fn().mockResolvedValue({
            data: mockDraft("d1", undefined, "2026-06-30T10:00:00.000Z"),
        });
        const gateway = {
            agents: { private: { draftSessions: { list: vi.fn(), create: vi.fn(), get } } },
        } as unknown as TrueFoundryGateway;

        const adapter = createTrueFoundryDraftThreadListAdapter({
            gateway,
            defaultAgentSpec,
        });

        const result = await adapter.fetch("d1");

        expect(result.title).toBe("anthropic/claude-sonnet-4-6");
    });
});
