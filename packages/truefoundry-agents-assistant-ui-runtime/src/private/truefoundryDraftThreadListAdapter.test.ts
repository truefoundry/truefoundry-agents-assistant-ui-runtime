import { describe, expect, it, vi } from "vitest";

import type { AgentChatServer, Session } from "../server/index.js";

import { createTrueFoundryDraftThreadListAdapter } from "./truefoundryDraftThreadListAdapter.js";
import type { AgentSpec } from "./agentSpec.js";

const defaultAgentSpec: AgentSpec = {
    model: { name: "anthropic/claude-sonnet-4-6" },
    instructions: "You are helpful.",
};

function mockDraft(id: string, title: string | undefined, updatedAt: string): Session {
    return {
        id,
        agentSpec: defaultAgentSpec,
        title,
        createdAt: updatedAt,
        updatedAt,
        isMutable: true,
    };
}

function mockDraftListPage(drafts: Session[], nextPageToken?: string) {
    return {
        data: drafts,
        ...(nextPageToken != null ? { nextPageToken } : {}),
    };
}

function mockServer(partial: Partial<AgentChatServer>): AgentChatServer {
    return partial as AgentChatServer;
}

describe("createTrueFoundryDraftThreadListAdapter", () => {
    it("lists draft sessions with pagination cursor", async () => {
        const listSessions = vi.fn().mockResolvedValue(
            mockDraftListPage(
                [mockDraft("d1", "My draft", "2026-06-30T10:00:00.000Z")],
                "page-2",
            ),
        );
        const server = mockServer({
            listSessions,
            createSession: vi.fn(),
            getSession: vi.fn(),
        });

        const adapter = createTrueFoundryDraftThreadListAdapter({
            server,
            defaultAgentSpec,
        });

        const result = await adapter.list();

        expect(listSessions).toHaveBeenCalledWith(
            expect.objectContaining({
                limit: 20,
                pageToken: undefined,
                startTimestamp: expect.any(String),
            }),
        );
        expect(listSessions).toHaveBeenCalledWith(
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
        const createSession = vi.fn().mockResolvedValue(
            mockDraft("d-new", undefined, "2026-06-30T12:00:00.000Z"),
        );
        const server = mockServer({
            listSessions: vi.fn(),
            createSession,
            getSession: vi.fn(),
        });

        const adapter = createTrueFoundryDraftThreadListAdapter({
            server,
            defaultAgentSpec,
        });

        const result = await adapter.initialize("local-thread-id");

        expect(createSession).toHaveBeenCalledWith({ agentSpec: defaultAgentSpec });
        expect(result).toEqual({ remoteId: "d-new", externalId: undefined });
    });

    it("creates a draft session with the live agent spec when getAgentSpec is provided", async () => {
        const liveAgentSpec: AgentSpec = {
            model: { name: "anthropic/claude-opus-4-8" },
            instructions: "You are helpful.",
            mcpServers: [{ id: "github", name: "github" }],
            skills: [{ id: "skill-a", name: "skill-a" }],
        };
        const createSession = vi.fn().mockResolvedValue(
            mockDraft("d-new", undefined, "2026-06-30T12:00:00.000Z"),
        );
        const server = mockServer({
            listSessions: vi.fn(),
            createSession,
            getSession: vi.fn(),
        });

        const adapter = createTrueFoundryDraftThreadListAdapter({
            server,
            defaultAgentSpec,
            getAgentSpec: () => liveAgentSpec,
        });

        await adapter.initialize("local-thread-id");

        expect(createSession).toHaveBeenCalledWith({ agentSpec: liveAgentSpec });
    });

    it("falls back to model name for title when draft has no title", async () => {
        const getSession = vi.fn().mockResolvedValue(
            mockDraft("d1", undefined, "2026-06-30T10:00:00.000Z"),
        );
        const server = mockServer({
            listSessions: vi.fn(),
            createSession: vi.fn(),
            getSession,
        });

        const adapter = createTrueFoundryDraftThreadListAdapter({
            server,
            defaultAgentSpec,
        });

        const result = await adapter.fetch("d1");

        expect(getSession).toHaveBeenCalledWith({ sessionId: "d1" });
        expect(result.title).toBe("anthropic/claude-sonnet-4-6");
    });
});
