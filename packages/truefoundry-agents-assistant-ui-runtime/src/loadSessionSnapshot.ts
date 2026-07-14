import type { AgentSessionClient } from "truefoundry-gateway-sdk/agents";

import { buildSnapshotFromSessionEvents } from "./convertTurnMessages.js";
import { getSession, type GetSessionOptions } from "./sessions.js";
import type { SessionSnapshot } from "./sessionSnapshot.js";

const inflightBySessionId = new Map<string, Promise<SessionSnapshot>>();

/**
 * Loads a session snapshot once per concurrent burst for a given session id.
 * React Strict Mode and overlapping fetch/load paths share the same in-flight
 * request instead of duplicating getSession + listEvents calls.
 *
 * `onProgress` is called after each complete turn is ingested so the caller
 * can update the UI progressively while history is being processed.
 */
export function loadSessionSnapshot(
    client: AgentSessionClient,
    sessionId: string,
    sessionOptions?: GetSessionOptions,
    onProgress?: (snap: SessionSnapshot) => void,
): Promise<SessionSnapshot> {
    const cacheKey =
        sessionOptions?.draftGateway != null ? `draft:${sessionId}` : sessionId;
    let inflight = inflightBySessionId.get(cacheKey);
    if (inflight == null) {
        inflight = getSession(client, sessionId, sessionOptions)
            .then((session) =>
                buildSnapshotFromSessionEvents(session, onProgress),
            )
            .finally(() => {
                if (inflightBySessionId.get(cacheKey) === inflight) {
                    inflightBySessionId.delete(cacheKey);
                }
            });
        inflightBySessionId.set(cacheKey, inflight);
    }
    return inflight;
}
