import type { RemoteThreadListAdapter } from "@assistant-ui/core";
import type { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";

import { draftSessionTitle, type AgentSpec } from "./agentSpec.js";
import { sessionListStartTimestamp } from "../sessionListStartTimestamp.js";

const THREAD_LIST_PAGE_SIZE = 20;

export function createTrueFoundryDraftThreadListAdapter(options: {
    privateClient: PrivateAgentSessionClient;
    defaultAgentSpec: AgentSpec;
    getAgentSpec?: () => AgentSpec;
}): RemoteThreadListAdapter {
    const { privateClient, defaultAgentSpec, getAgentSpec } = options;

    return {
        async list({ after } = {}) {
            const page = await privateClient.listDraftSessions({
                limit: THREAD_LIST_PAGE_SIZE,
                pageToken: after,
                startTimestamp: sessionListStartTimestamp(),
            });
            const threads = page.data.map((draft) => ({
                status: "regular" as const,
                remoteId: draft.id,
                title: draftSessionTitle(draft),
                lastMessageAt: new Date(draft.updatedAt),
            }));
            return {
                threads,
                nextCursor: page.response.pagination.nextPageToken ?? undefined,
            };
        },

        async initialize(_threadId: string) {
            const draft = await privateClient.createDraftSession({
                agentSpec: getAgentSpec?.() ?? defaultAgentSpec,
            });
            return { remoteId: draft.id, externalId: undefined };
        },

        async fetch(remoteId) {
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
