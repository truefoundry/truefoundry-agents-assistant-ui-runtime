import type {
    AgentSessionClient,
    AgentSession,
} from "truefoundry-gateway-sdk/agents";

const inflightBySessionId = new Map<string, Promise<AgentSession>>();

/** `sessionId` is the assistant-ui thread `remoteId` from `RemoteThreadListAdapter.initialize`. */
export function getSession(
    client: AgentSessionClient,
    sessionId: string,
): Promise<AgentSession> {
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
