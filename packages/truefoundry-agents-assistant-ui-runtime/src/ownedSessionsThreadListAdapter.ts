import type { RemoteThreadListAdapter } from "@assistant-ui/core";

import type { AgentChatServer } from "./server/types.js";
import { sessionListStartTimestamp } from "./sessionListStartTimestamp.js";
import {
    sessionDisplayTitle,
    sessionToThreadMetadata,
} from "./sessionThreadMetadata.js";

const THREAD_LIST_PAGE_SIZE = 20;

/**
 * Read-only thread-list adapter backed by `AgentChatServer.listSessions`.
 * Hosts that previously used listOwnedSessions should filter in their server impl.
 */
export function createOwnedSessionsThreadListAdapter(options: {
    server: AgentChatServer;
    /** When set, filters `listSessions` by this agent id. Omit for all chats. */
    listSessionsAgentId?: string;
}): RemoteThreadListAdapter {
    const { server, listSessionsAgentId } = options;

    return {
        async list({ after } = {}) {
            const page = await server.listSessions({
                ...(listSessionsAgentId != null ? { agentId: listSessionsAgentId } : {}),
                limit: THREAD_LIST_PAGE_SIZE,
                pageToken: after,
                startTimestamp: sessionListStartTimestamp(),
            });
            const threads = page.data.map((session) =>
                sessionToThreadMetadata(session, sessionDisplayTitle(session)),
            );
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
            return sessionToThreadMetadata(session, sessionDisplayTitle(session));
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
