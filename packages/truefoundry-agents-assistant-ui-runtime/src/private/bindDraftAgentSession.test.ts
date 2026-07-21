import { describe, expect, it, vi } from "vitest";

import type { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";

import { bindDraftAgentSession } from "./bindDraftAgentSession.js";

const draft = {
    type: "session/draft" as const,
    id: "draft-1",
    agentSpec: { model: { name: "anthropic/claude-sonnet-4-6" } },
    createdBySubject: { type: "user" as const, id: "u1" },
    createdAt: "2026-06-30T10:00:00.000Z",
    updatedAt: "2026-06-30T10:00:00.000Z",
};

describe("bindDraftAgentSession", () => {
    it("validates the draft and binds turns to the draft session id", async () => {
        const getDraftSession = vi.fn().mockResolvedValue(draft);
        const privateClient = {
            getDraftSession,
        } as unknown as PrivateAgentSessionClient;

        const session = await bindDraftAgentSession(privateClient, "draft-1");

        expect(getDraftSession).toHaveBeenCalledWith({ draftSessionId: "draft-1" });
        expect(session.id).toBe("draft-1");
    });
});

describe("createDraftSessionBridge", () => {
    it("syncs agent spec via draftSessions.update and returns updatedAt", async () => {
        const { createDraftSessionBridge } = await import("./draftSessionBridge.js");
        const update = vi.fn().mockResolvedValue({ data: draft });
        const getDraftSession = vi.fn().mockResolvedValue(draft);
        const privateClient = {
            getDraftSession,
            client: {
                agents: {
                    private: {
                        draftSessions: { update },
                    },
                },
            },
        } as unknown as PrivateAgentSessionClient;

        const bridge = createDraftSessionBridge(privateClient);
        const updatedAt = await bridge.syncAgentSpec("draft-1", draft.agentSpec);

        expect(update).toHaveBeenCalledWith("draft-1", {
            agentSpec: draft.agentSpec,
        });
        expect(updatedAt).toBe(draft.updatedAt);
    });
});
