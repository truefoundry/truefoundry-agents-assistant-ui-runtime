import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";

import type { AgentSpec } from "./agentSpec.js";

export type DraftSessionBridge = {
    ensureDraftSession: (draftSessionId: string) => Promise<void>;
    syncAgentSpec: (draftSessionId: string, agentSpec: AgentSpec) => Promise<void>;
    getDraftAgentSpec: (draftSessionId: string) => Promise<AgentSpec>;
};

export function createDraftSessionBridge(
    gateway: TrueFoundryGateway,
): DraftSessionBridge {
    async function getDraft(draftSessionId: string) {
        const response = await gateway.agents.draftSessions.get(draftSessionId);
        return response.data;
    }

    return {
        async ensureDraftSession(draftSessionId) {
            await getDraft(draftSessionId);
        },

        async getDraftAgentSpec(draftSessionId) {
            const draft = await getDraft(draftSessionId);
            return draft.agentSpec;
        },

        async syncAgentSpec(draftSessionId, agentSpec) {
            await gateway.agents.draftSessions.update(draftSessionId, { agentSpec });
        },
    };
}
