import type {
    AgentSession,
    AgentSessionClient,
} from "truefoundry-gateway-sdk/agents";
import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";

import { bindDraftAgentSession } from "./bindDraftAgentSession.js";

const inflightBySessionId = new Map<string, Promise<AgentSession>>();

export type GetSessionOptions = {
    /** When set, validates the draft and binds turns to `/agents/sessions/{id}/turns`. */
    draftGateway?: TrueFoundryGateway;
};

/** `sessionId` is the assistant-ui thread `remoteId` from `RemoteThreadListAdapter.initialize`. */
export function getSession(
    client: AgentSessionClient,
    sessionId: string,
    options?: GetSessionOptions,
): Promise<AgentSession> {
    if (options?.draftGateway != null) {
        return bindDraftAgentSession(client, options.draftGateway, sessionId);
    }

    let inflight = inflightBySessionId.get(sessionId);
    if (inflight == null) {
        inflight = client.getSession({ sessionId }).finally(() => {
            if (inflightBySessionId.get(sessionId) === inflight) {
                inflightBySessionId.delete(sessionId);
            }
        });
        inflightBySessionId.set(sessionId, inflight);
    }
    return inflight;
}
