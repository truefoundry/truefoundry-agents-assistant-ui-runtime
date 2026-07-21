import type { RemoteThreadListAdapter } from "@assistant-ui/core";
import type { AgentSession } from "truefoundry-gateway-sdk/agents";
import type {
    AgentDraftSession,
    PrivateAgentSessionClient,
} from "truefoundry-gateway-sdk/agents/private";

import { draftSessionTitle } from "./private/agentSpec.js";
import { sessionListStartTimestamp } from "./sessionListStartTimestamp.js";

const THREAD_LIST_PAGE_SIZE = 20;

function ownedSessionTitle(session: AgentSession | AgentDraftSession): string {
    if (session.type === "session/draft") {
        return draftSessionTitle(session);
    }
    return session.title ?? session.agentName;
}

/**
 * Read-only thread-list adapter backed by `PrivateAgentSessionClient.listOwnedSessions`.
 * Returns every session the caller owns (named + draft), newest first.
 */
export function createTrueFoundryOwnedSessionsThreadListAdapter(options: {
    privateClient: PrivateAgentSessionClient;
}): RemoteThreadListAdapter {
    const { privateClient } = options;

    return {
        async list({ after } = {}) {
            const page = await privateClient.listOwnedSessions({
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
                nextCursor: page.response.pagination.nextPageToken ?? undefined,
            };
        },

        async initialize() {
            throw new Error(
                "Owned sessions history adapter is read-only; create sessions via a named or draft runtime.",
            );
        },

        async fetch(remoteId) {
            // PrivateAgentSessionClient only exposes get for drafts. Named sessions
            // surface through listOwnedSessions; fetch falls back to draft get.
            const draft = await privateClient.getDraftSession({
                draftSessionId: remoteId,
            });
            return {
                status: "regular" as const,
                remoteId: draft.id,
                title: draftSessionTitle(draft),
                lastMessageAt: new Date(draft.updatedAt),
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
