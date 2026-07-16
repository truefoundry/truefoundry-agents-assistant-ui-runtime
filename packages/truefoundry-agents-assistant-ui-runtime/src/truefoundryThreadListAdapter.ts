import type { RemoteThreadListAdapter } from "@assistant-ui/core";
import type { AgentSessionClient } from "truefoundry-gateway-sdk/agents";

import { getSession } from "./sessions.js";
import { sessionListStartTimestamp } from "./sessionListStartTimestamp.js";

import { createTrueFoundryThreadHistoryProvider } from "./truefoundryThreadHistoryProvider.js";

const THREAD_LIST_PAGE_SIZE = 20;
const threadHistoryProvider = createTrueFoundryThreadHistoryProvider();

export function createTrueFoundryThreadListAdapter(options: {
    client: AgentSessionClient;
    agentName: string;
}): RemoteThreadListAdapter {
    const { client, agentName } = options;

    return {
        unstable_Provider: threadHistoryProvider,

        async list({ after } = {}) {
            const page = await client.listSessions({
                agentName,
                limit: THREAD_LIST_PAGE_SIZE,
                pageToken: after,
                startTimestamp: sessionListStartTimestamp(),
            });
            const threads = page.data.map((session) => ({
                status: "regular" as const,
                remoteId: session.id,
                title: session.title,
                lastMessageAt: new Date(session.updatedAt),
            }));
            return {
                threads,
                nextCursor: page.response.pagination.nextPageToken ?? undefined,
            };
        },

        async initialize(_threadId: string) {
            const session = await client.createSession({ agentName });
            return { remoteId: session.id, externalId: undefined };
        },

        async fetch(remoteId) {
            const session = await getSession(client, remoteId);
            return {
                status: "regular" as const,
                remoteId: session.id,
                title: session.title,
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
