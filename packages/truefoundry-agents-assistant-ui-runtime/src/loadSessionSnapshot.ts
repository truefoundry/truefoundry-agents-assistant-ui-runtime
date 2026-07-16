import type { AgentSessionClient } from "truefoundry-gateway-sdk/agents";

import {
    buildSnapshotFromSessionEventsPage,
    type GatewaySessionEventItem,
} from "./convertTurnMessages.js";
import { getSession, type GetSessionOptions } from "./sessions.js";
import type { SessionSnapshot } from "./sessionSnapshot.js";

const inflightBySessionId = new Map<string, Promise<LoadSessionSnapshotResult>>();

export type LoadSessionSnapshotOptions = GetSessionOptions & {
    historyPageSize?: number | undefined;
};

export type LoadSessionSnapshotResult = {
    snapshot: SessionSnapshot;
    chronologicalItems: GatewaySessionEventItem[];
    nextPageToken: string | undefined;
    hasMore: boolean;
};

/**
 * Loads the newest page of session history once per concurrent burst for a
 * given session id. React Strict Mode and overlapping fetch/load paths share
 * the same in-flight request instead of duplicating getSession + listEvents.
 *
 * `onProgress` is called after each complete turn is ingested so the caller
 * can update the UI progressively while history is being processed.
 */
export function loadSessionSnapshot(
    client: AgentSessionClient,
    sessionId: string,
    sessionOptions?: LoadSessionSnapshotOptions,
    onProgress?: (snap: SessionSnapshot) => void,
): Promise<LoadSessionSnapshotResult> {
    const { historyPageSize, ...getSessionOptions } = sessionOptions ?? {};
    const cacheKey =
        getSessionOptions.draftGateway != null ? `draft:${sessionId}` : sessionId;
    let inflight = inflightBySessionId.get(cacheKey);
    if (inflight == null) {
        inflight = getSession(client, sessionId, getSessionOptions)
            .then((session) =>
                buildSnapshotFromSessionEventsPage(session, {
                    limit: historyPageSize,
                    onProgress,
                }),
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
