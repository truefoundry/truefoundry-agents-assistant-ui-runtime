import type { RemoteThreadListAdapter } from "@assistant-ui/core";

import type { AgentChatServer } from "../server/types.js";
import { draftSessionTitle, type AgentSpec } from "./agentSpec.js";
import { sessionListStartTimestamp } from "../sessionListStartTimestamp.js";

const THREAD_LIST_PAGE_SIZE = 20;

export function createTrueFoundryDraftThreadListAdapter(options: {
    server: AgentChatServer;
    defaultAgentSpec: AgentSpec;
    getAgentSpec?: () => AgentSpec;
}): RemoteThreadListAdapter {
    const { server, defaultAgentSpec, getAgentSpec } = options;

    return {
        async list({ after } = {}) {
            const page = await server.listSessions({
                limit: THREAD_LIST_PAGE_SIZE,
                pageToken: after,
                startTimestamp: sessionListStartTimestamp(),
            });
            const threads = page.data
                .filter((session) => session.isMutable)
                .map((draft) => ({
                    status: "regular" as const,
                    remoteId: draft.id,
                    title: draftSessionTitle({
                        title: draft.title,
                        agentSpec: draft.agentSpec ?? defaultAgentSpec,
                    }),
                    lastMessageAt: new Date(draft.updatedAt),
                }));
            return {
                threads,
                nextCursor: page.nextPageToken ?? undefined,
            };
        },

        async initialize(_threadId: string) {
            const draft = await server.createSession({
                agentSpec: getAgentSpec?.() ?? defaultAgentSpec,
            });
            return { remoteId: draft.id, externalId: undefined };
        },

        async fetch(remoteId) {
            const draft = await server.getSession({ sessionId: remoteId });
            return {
                status: "regular" as const,
                remoteId: draft.id,
                title: draftSessionTitle({
                    title: draft.title,
                    agentSpec: draft.agentSpec ?? defaultAgentSpec,
                }),
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
