import type { AgentSession } from "truefoundry-gateway-sdk/agents";
import type { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";

const inflightByDraftId = new Map<string, Promise<AgentSession>>();

/**
 * Binds turn APIs for a draft session via `PrivateAgentSessionClient.getDraftSession`.
 * Returns an `AgentDraftSession` (identical turn surface to `AgentSession`).
 */
export async function bindDraftAgentSession(
    privateClient: PrivateAgentSessionClient,
    draftSessionId: string,
): Promise<AgentSession> {
    let inflight = inflightByDraftId.get(draftSessionId);
    if (inflight == null) {
        inflight = privateClient
            .getDraftSession({ draftSessionId })
            // AgentDraftSession shares the turn API with AgentSession.
            .then((draft) => draft as unknown as AgentSession)
            .finally(() => {
                if (inflightByDraftId.get(draftSessionId) === inflight) {
                    inflightByDraftId.delete(draftSessionId);
                }
            });
        inflightByDraftId.set(draftSessionId, inflight);
    }
    return inflight;
}
