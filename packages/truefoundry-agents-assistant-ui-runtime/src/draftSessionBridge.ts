import type { AgentSession, AgentSessionClient } from "truefoundry-gateway-sdk/agents";
import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";

import type { AgentSpec } from "./agentSpec.js";
import { getSession } from "./sessions.js";

export type DraftSessionBridge = {
    resolveConversationSession: (draftSessionId: string) => Promise<AgentSession>;
    syncAgentSpec: (draftSessionId: string, agentSpec: AgentSpec) => Promise<void>;
    getDraftAgentSpec: (draftSessionId: string) => Promise<AgentSpec>;
};

type CreateSessionFromDraftBody = {
    draft_session_id: string;
};

type CreateSessionResponseBody = {
    data: {
        id: string;
    };
};

export function createDraftSessionBridge(
    client: AgentSessionClient,
    gateway: TrueFoundryGateway,
): DraftSessionBridge {
    const conversationSessionByDraftId = new Map<string, string>();

    async function getDraft(draftSessionId: string) {
        const response = await gateway.agents.draftSessions.get(draftSessionId);
        return response.data;
    }

    return {
        async getDraftAgentSpec(draftSessionId) {
            const draft = await getDraft(draftSessionId);
            return draft.agentSpec;
        },

        async syncAgentSpec(draftSessionId, agentSpec) {
            await gateway.agents.draftSessions.update(draftSessionId, { agentSpec });
        },

        async resolveConversationSession(draftSessionId) {
            const cachedSessionId = conversationSessionByDraftId.get(draftSessionId);
            if (cachedSessionId != null) {
                return getSession(client, cachedSessionId);
            }

            await getDraft(draftSessionId);

            try {
                const session = await getSession(client, draftSessionId);
                conversationSessionByDraftId.set(draftSessionId, draftSessionId);
                return session;
            } catch (primaryError) {
                const response = await gateway.fetch("v1/agents/sessions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        draft_session_id: draftSessionId,
                    } satisfies CreateSessionFromDraftBody),
                });

                if (!response.ok) {
                    throw primaryError;
                }

                const body = (await response.json()) as CreateSessionResponseBody;
                const sessionId = body.data.id;
                conversationSessionByDraftId.set(draftSessionId, sessionId);
                return getSession(client, sessionId);
            }
        },
    };
}
