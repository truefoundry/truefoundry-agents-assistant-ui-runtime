import type { RemoteThreadListAdapter } from "@assistant-ui/core";

import type { AgentChatServer, Session } from "./server/types.js";
import { draftSessionTitle } from "./private/agentSpec.js";
import { sessionListStartTimestamp } from "./sessionListStartTimestamp.js";

const THREAD_LIST_PAGE_SIZE = 20;

function ownedSessionTitle(session: Session): string {
    if (session.isMutable && session.agentSpec != null) {
        return draftSessionTitle({
            title: session.title,
            agentSpec: session.agentSpec,
        });
    }
    return session.title ?? session.agentName ?? session.id;
}

/**
 * Read-only thread-list adapter backed by `AgentChatServer.listSessions`.
 * Hosts that previously used listOwnedSessions should filter in their server impl.
 */
export function createTrueFoundryOwnedSessionsThreadListAdapter(options: {
    server: AgentChatServer;
}): RemoteThreadListAdapter {
    const { server } = options;

    return {
        async list({ after } = {}) {
            const page = await server.listSessions({
                limit: THREAD_LIST_PAGE_SIZE,
                pageToken: after,
                startTimestamp: sessionListStartTimestamp(),
            });
            const threads = page.data.map((session) => ({
                status: "regular" as const,
                remoteId: session.id,
                title: ownedSessionTitle(session),
                lastMessageAt: new Date(session.updatedAt),
            }));
            return {
                threads,
                nextCursor: page.nextPageToken ?? undefined,
            };
        },

        async initialize() {
            throw new Error(
                "Owned sessions history adapter is read-only; create sessions via a named or draft runtime.",
            );
        },

        async fetch(remoteId) {
            const session = await server.getSession({ sessionId: remoteId });
            return {
                status: "regular" as const,
                remoteId: session.id,
                title: ownedSessionTitle(session),
                lastMessageAt: new Date(session.updatedAt),
            };
        },

        async rename() {},
        async archive() {},
        async unarchive() {},
        async delete() {},

        async generateTitle() {
            return new ReadableStream();
        },
    };
}
