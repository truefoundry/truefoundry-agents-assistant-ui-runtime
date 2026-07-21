import type { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";

import type { AgentSpec } from "./agentSpec.js";
import { getGatewayFromPrivateClient } from "./getGatewayFromPrivateClient.js";

export const DRAFT_SESSION_LAST_UPDATED_AT_HEADER = "x-tfy-session-last-updated-at";

export type DraftSessionBridge = {
    syncAgentSpec: (draftSessionId: string, agentSpec: AgentSpec) => Promise<string>;
    getDraftAgentSpec: (draftSessionId: string) => Promise<AgentSpec>;
};

export function createDraftSessionBridge(
    privateClient: PrivateAgentSessionClient,
): DraftSessionBridge {
    return {
        async getDraftAgentSpec(draftSessionId) {
            const draft = await privateClient.getDraftSession({ draftSessionId });
            return draft.agentSpec;
        },

        async syncAgentSpec(draftSessionId, agentSpec) {
            // PrivateAgentSessionClient does not wrap update yet — use the low-level client.
            const gateway = getGatewayFromPrivateClient(privateClient);
            const response = await gateway.agents.private.draftSessions.update(
                draftSessionId,
                { agentSpec },
            );
            return response.data.updatedAt;
        },
    };
}
