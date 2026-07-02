import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";
import type { AgentSession, AgentSessionClient } from "truefoundry-gateway-sdk/agents";
// SDK does not publicly export the AgentSession class; bind draft ids for turn routes.
import { AgentSession as AgentSessionClass } from "truefoundry-gateway-sdk/dist/esm/agents/AgentSession.mjs";

import type { DraftSession } from "./agentSpec.js";

type SessionRecord = {
    id: string;
    agentName: string;
    title?: string;
    createdBySubject: DraftSession["createdBySubject"];
    createdAt: string;
    updatedAt: string;
};

const inflightByDraftId = new Map<string, Promise<AgentSession>>();

export function getGatewayFromSessionClient(
    client: AgentSessionClient,
): TrueFoundryGateway {
    const internal = client as unknown as { client: TrueFoundryGateway };
    if (internal.client == null) {
        throw new Error("AgentSessionClient is missing an internal gateway client.");
    }
    return internal.client;
}

function draftToSessionRecord(draft: DraftSession): SessionRecord {
    return {
        id: draft.id,
        agentName: draft.agentName ?? "",
        title: draft.title,
        createdBySubject: draft.createdBySubject,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
    };
}

/**
 * Binds an `AgentSession` for turn APIs at `/agents/sessions/{draftSessionId}/turns`
 * after validating the draft via `GET draft-sessions/{draftSessionId}`.
 * Does not call `GET` or `POST` on `/agents/sessions` root.
 */
export async function bindDraftAgentSession(
    client: AgentSessionClient,
    gateway: TrueFoundryGateway,
    draftSessionId: string,
): Promise<AgentSession> {
    let inflight = inflightByDraftId.get(draftSessionId);
    if (inflight == null) {
        inflight = (async () => {
            const response = await gateway.agents.draftSessions.get(draftSessionId);
            return new AgentSessionClass(
                draftToSessionRecord(response.data),
                getGatewayFromSessionClient(client),
            ) as AgentSession;
        })().finally(() => {
            if (inflightByDraftId.get(draftSessionId) === inflight) {
                inflightByDraftId.delete(draftSessionId);
            }
        });
        inflightByDraftId.set(draftSessionId, inflight);
    }
    return inflight;
}
