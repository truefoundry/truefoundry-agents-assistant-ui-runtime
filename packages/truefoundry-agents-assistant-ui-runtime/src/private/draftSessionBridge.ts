import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";

import type { AgentSpec } from "./agentSpec.js";

export const DRAFT_SESSION_LAST_UPDATED_AT_HEADER = "x-tfy-session-last-updated-at";

export type DraftSessionBridge = {
    syncAgentSpec: (draftSessionId: string, agentSpec: AgentSpec) => Promise<string>;
    getDraftAgentSpec: (draftSessionId: string) => Promise<AgentSpec>;
};

export function createDraftSessionBridge(
    gateway: TrueFoundryGateway,
): DraftSessionBridge {
    async function getDraft(draftSessionId: string) {
        const response = await gateway.agents.private.draftSessions.get(draftSessionId);
        return response.data;
    }

    return {
        async getDraftAgentSpec(draftSessionId) {
            const draft = await getDraft(draftSessionId);
            return draft.agentSpec;
        },

        async syncAgentSpec(draftSessionId, agentSpec) {
            const response = await gateway.agents.private.draftSessions.update(
                draftSessionId,
                { agentSpec },
            );
            return response.data.updatedAt;
        },
    };
}
