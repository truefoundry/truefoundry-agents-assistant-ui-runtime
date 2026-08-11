import type { RemoteThreadListAdapter } from "@assistant-ui/core";

import type { AgentChatServer } from "./server/types.js";
import { getSession } from "./sessions.js";
import { sessionListStartTimestamp } from "./sessionListStartTimestamp.js";
import { sessionToThreadMetadata } from "./sessionThreadMetadata.js";

const THREAD_LIST_PAGE_SIZE = 20;

export function createThreadListAdapter(options: {
    server: AgentChatServer;
    agentName: string;
    /** When set, filters `listSessions` by this agent id. Omit for all chats. */
    listSessionsAgentId?: string;
}): RemoteThreadListAdapter {
    const { server, agentName, listSessionsAgentId } = options;

    return {
        async list({ after } = {}) {
            const page = await server.listSessions({
                ...(listSessionsAgentId != null ? { agentId: listSessionsAgentId } : {}),
                limit: THREAD_LIST_PAGE_SIZE,
                pageToken: after,
                startTimestamp: sessionListStartTimestamp(),
            });
            const threads = page.data.map((session) =>
                sessionToThreadMetadata(session, session.title ?? undefined),
            );
            return {
                threads,
                nextCursor: page.nextPageToken ?? undefined,
            };
        },

        async initialize(_threadId: string) {
            const session = await server.createSession({ agentName });
            return { remoteId: session.id, externalId: undefined };
        },

        async fetch(remoteId) {
            const session = await getSession(server, remoteId);
            return sessionToThreadMetadata(session, session.title ?? undefined);
        },

        async rename() {},
        async archive() {},
        async unarchive() {},
        async delete(remoteId) {
            if (typeof server.deleteSession !== "function") return;
            await server.deleteSession({ sessionId: remoteId });
        },

        async generateTitle() {
            return new ReadableStream();
        },
    };
}
