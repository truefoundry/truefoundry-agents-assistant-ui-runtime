import type { AgentSessionClient } from "truefoundry-gateway-sdk/agents";

import { buildSnapshotFromSession } from "./convertTurnMessages.js";
import { getSession } from "./sessions.js";
import type { SessionSnapshot } from "./sessionSnapshot.js";

const inflightBySessionId = new Map<string, Promise<SessionSnapshot>>();

/**
 * Loads a session snapshot once per concurrent burst for a given session id.
 * React Strict Mode and overlapping fetch/load paths share the same in-flight
 * request instead of duplicating getSession + listTurns calls.
 */
export function loadSessionSnapshot(
    client: AgentSessionClient,
    sessionId: string,
    concurrency?: number,
): Promise<SessionSnapshot> {
    let inflight = inflightBySessionId.get(sessionId);
    if (inflight == null) {
        inflight = getSession(client, sessionId)
            .then((session) => buildSnapshotFromSession(session, concurrency))
            .finally(() => {
                if (inflightBySessionId.get(sessionId) === inflight) {
                    inflightBySessionId.delete(sessionId);
                }
            });
        inflightBySessionId.set(sessionId, inflight);
    }
    return inflight;
}
