import { describe, expect, it, vi } from "vitest";

import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";
import type { AgentSessionClient } from "truefoundry-gateway-sdk/agents";

import { bindDraftAgentSession } from "./bindDraftAgentSession.js";

const draft = {
    id: "draft-1",
    agentSpec: { model: { name: "anthropic/claude-sonnet-4-6" } },
    createdBySubject: { type: "user" as const, id: "u1" },
    createdAt: "2026-06-30T10:00:00.000Z",
    updatedAt: "2026-06-30T10:00:00.000Z",
};

describe("bindDraftAgentSession", () => {
    it("validates the draft and binds turns to the draft session id", async () => {
        const get = vi.fn().mockResolvedValue({ data: draft });
        const gateway = {
            agents: { private: { draftSessions: { get } } },
        } as unknown as TrueFoundryGateway;
        const client = {
            client: gateway,
        } as unknown as AgentSessionClient;

        const session = await bindDraftAgentSession(client, gateway, "draft-1");

        expect(get).toHaveBeenCalledWith("draft-1");
        expect(session.id).toBe("draft-1");
    });
});

describe("createDraftSessionBridge", () => {
    it("syncs agent spec via draftSessions.update and returns updatedAt", async () => {
        const { createDraftSessionBridge } = await import("./draftSessionBridge.js");
        const update = vi.fn().mockResolvedValue({ data: draft });
        const gateway = {
            agents: {
                private: {
                    draftSessions: {
                        get: vi.fn().mockResolvedValue({ data: draft }),
                        update,
                    },
                },
            },
        } as unknown as TrueFoundryGateway;

        const bridge = createDraftSessionBridge(gateway);
        const updatedAt = await bridge.syncAgentSpec("draft-1", draft.agentSpec);

        expect(update).toHaveBeenCalledWith("draft-1", {
            agentSpec: draft.agentSpec,
        });
        expect(updatedAt).toBe(draft.updatedAt);
    });
});
