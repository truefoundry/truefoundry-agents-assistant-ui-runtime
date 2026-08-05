import type { RemoteThreadListAdapter } from "@assistant-ui/core";

import type { AgentChatServer } from "./server/types.js";
import { getSession } from "./sessions.js";
import { sessionListStartTimestamp } from "./sessionListStartTimestamp.js";

const THREAD_LIST_PAGE_SIZE = 20;

export function createTrueFoundryThreadListAdapter(options: {
    server: AgentChatServer;
    agentName: string;
}): RemoteThreadListAdapter {
    const { server, agentName } = options;

    return {
        async list({ after } = {}) {
            const page = await server.listSessions({
                agentName,
                limit: THREAD_LIST_PAGE_SIZE,
                pageToken: after,
                startTimestamp: sessionListStartTimestamp(),
            });
            const threads = page.data.map((session) => ({
                status: "regular" as const,
                remoteId: session.id,
                title: session.title ?? undefined,
                lastMessageAt: new Date(session.updatedAt),
            }));
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
            return {
                status: "regular" as const,
                remoteId: session.id,
                title: session.title ?? undefined,
                lastMessageAt: new Date(session.updatedAt),
            };
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
