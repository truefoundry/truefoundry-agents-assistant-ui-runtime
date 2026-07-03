import type { RemoteThreadListAdapter } from "@assistant-ui/core";
import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";

import { draftSessionTitle, type AgentSpec } from "./agentSpec.js";
import { sessionListStartTimestamp } from "./sessionListStartTimestamp.js";

const THREAD_LIST_PAGE_SIZE = 20;

export function createTrueFoundryDraftThreadListAdapter(options: {
    gateway: TrueFoundryGateway;
    defaultAgentSpec: AgentSpec;
    getAgentSpec?: () => AgentSpec;
}): RemoteThreadListAdapter {
    const { gateway, defaultAgentSpec, getAgentSpec } = options;

    return {
        async list({ after } = {}) {
            const page = await gateway.agents.private.draftSessions.list({
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
            const response = await gateway.agents.private.draftSessions.create({
                agentSpec: getAgentSpec?.() ?? defaultAgentSpec,
            });
            const draft = response.data;
            return { remoteId: draft.id, externalId: undefined };
        },

        async fetch(remoteId) {
            const response = await gateway.agents.private.draftSessions.get(remoteId);
            const draft = response.data;
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
