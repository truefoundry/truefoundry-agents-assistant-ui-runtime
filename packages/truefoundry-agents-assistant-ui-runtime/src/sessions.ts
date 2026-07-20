import type {
    AgentSession,
    AgentSessionClient,
} from "truefoundry-gateway-sdk/agents";
import type { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";

import { bindDraftAgentSession } from "./private/bindDraftAgentSession.js";

const inflightBySessionId = new Map<string, Promise<AgentSession>>();

export type GetSessionOptions = {
    /** When set, validates the draft and binds turns via PrivateAgentSessionClient. */
    privateClient?: PrivateAgentSessionClient;
};

/** `sessionId` is the assistant-ui thread `remoteId` from `RemoteThreadListAdapter.initialize`. */
export function getSession(
    client: AgentSessionClient,
    sessionId: string,
    options?: GetSessionOptions,
): Promise<AgentSession> {
    if (options?.privateClient != null) {
        return bindDraftAgentSession(options.privateClient, sessionId);
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
