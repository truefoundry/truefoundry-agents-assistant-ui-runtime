import { AgentSessionClient } from "truefoundry-gateway-sdk/agents";
import type { AgentSession } from "truefoundry-gateway-sdk/agents";
import { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";
import type { AgentDraftSession } from "truefoundry-gateway-sdk/agents/private";
import type {
    AgentChatServer,
    ListResult,
    TurnInputItem,
    PreviousTurnIdInput,
    UpdateSessionRequest,
} from "../../server/types.js";
import type {
    SessionEventItem,
    TurnEvent,
    TurnStreamData,
} from "../../server/events.js";
import type {
    TfyAgentSpec,
    TfyCreateSessionRequest,
    TfyListSessionsParams,
    TfySession,
    TfyTurn,
    TfyTurnState,
} from "./types.js";

export {
    type TfyAgentSpec,
    type TfySkillMount,
    type TfyMcpServerMount,
    type TfyModelParams,
    type TfyRuntimeConfig,
    type TfyResponseFormat,
    type TfySubject,
    type ToolsSelectorItem,
    type ToolsSelectorTag,
    type RequireApprovalToolSelectorItem,
    type RequireApprovalToolsSelectorTag,
    type TfyTurn,
    type TfyTurnState,
    type TfyTurnCancelledReason,
    type TfyTurnStateDoneOutput,
    type TfySession,
    type TfyCreateSessionRequest,
    type TfyListSessionsParams,
    type TfyToolInfo,
    type TfySystemToolInfo,
    type TfyMcpToolInfo,
    type TfyModelMessageUsage,
    type TfyFinishReason,
    type TfyThreadState,
    type TfyMcpServerInitInfo,
} from "./types.js";

export {
    isTfyToolInfo,
    isTfySystemToolInfo,
    isTfyMcpToolInfo,
    getTfyUsage,
    getTfyThreadState,
    getTfyMcpInitServers,
} from "./guards.js";

type GwSession = AgentSession | AgentDraftSession;

export type CreateTrueFoundryChatServerOptions = {
    apiKey: string;
    baseUrl: string;
    /** Optional override — otherwise constructed from apiKey/baseUrl. */
    client?: AgentSessionClient;
    privateClient?: PrivateAgentSessionClient;
    deleteSession?: (req: { sessionId: string }) => Promise<void>;
};

/**
 * Only the spec is generic. Session/Turn/list-params are the concrete Tfy*
 * types because the adapter builds them as fixed object literals — a generic
 * there would type fields that nothing ever populates. The spec is safe: the
 * gateway SDK serializes with `unrecognizedObjectKeys: "passthrough"`, so
 * host-added spec fields survive the round trip.
 */
export type TrueFoundryChatServer<TSpec extends TfyAgentSpec = TfyAgentSpec> =
    AgentChatServer<
        TSpec,
        TfySession<TSpec>,
        TfyCreateSessionRequest<TSpec>,
        TfyListSessionsParams,
        UpdateSessionRequest<TSpec>,
        TfyTurn
    > & {
        /** Escape hatch for hosts that still need raw gateway clients. */
        getGatewayClients(): {
            client: AgentSessionClient;
            privateClient: PrivateAgentSessionClient;
        };
    };

function isDraft(session: GwSession): session is AgentDraftSession {
    return (session as AgentDraftSession).type === "session/draft";
}

function toSession<TSpec extends TfyAgentSpec>(raw: GwSession): TfySession<TSpec> {
    const mutable = isDraft(raw);
    return {
        id: raw.id,
        title: raw.title,
        agentName: raw.agentName,
        ...(mutable ? { agentSpec: raw.agentSpec as TSpec } : {}),
        isMutable: mutable,
        createdBySubject: raw.createdBySubject,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    };
}

function toTurn(raw: {
    id: string;
    sessionId: string;
    previousTurnId?: string | null;
    input?: TurnInputItem[];
    state: unknown;
    createdBySubject: TfyTurn["createdBySubject"];
    createdAt: string;
}): TfyTurn {
    return {
        id: raw.id,
        sessionId: raw.sessionId,
        previousTurnId: raw.previousTurnId,
        input: raw.input,
        state: raw.state as TfyTurnState,
        createdBySubject: raw.createdBySubject,
        createdAt: raw.createdAt,
    };
}

async function toListResult<TIn, TOut>(
    page: {
        data: TIn[];
        response?: { pagination?: { nextPageToken?: string } };
        hasNextPage?: () => boolean;
    },
    map: (item: TIn) => TOut,
): Promise<ListResult<TOut>> {
    const nextPageToken = page.response?.pagination?.nextPageToken;
    return {
        data: page.data.map(map),
        ...(nextPageToken != null && nextPageToken !== ""
            ? { nextPageToken }
            : {}),
    };
}

/**
 * Wraps TrueFoundry gateway clients into a flat `AgentChatServer`.
 * Named vs draft routing is fully internal — an in-memory session-type cache
 * (populated by createSession/listSessions) determines which gateway client
 * to call, falling back to a one-time probe for ids seen only in a URL.
 */
export function createTrueFoundryChatServer<
    TSpec extends TfyAgentSpec = TfyAgentSpec,
>(
    opts: CreateTrueFoundryChatServerOptions,
): TrueFoundryChatServer<TSpec> {
    const gatewayOpts = { apiKey: opts.apiKey, baseUrl: opts.baseUrl };
    const client = opts.client ?? new AgentSessionClient(gatewayOpts);
    const privateClient =
        opts.privateClient ?? new PrivateAgentSessionClient(gatewayOpts);

    const sessionTypeCache = new Map<string, boolean>();
    const sessionTypeProbes = new Map<string, Promise<boolean>>();

    function cacheSessionType(session: {
        id: string;
        isMutable: boolean;
    }): void {
        sessionTypeCache.set(session.id, session.isMutable);
    }

    /**
     * Resolving a session id straight from a URL (page reload / shared link)
     * reaches the gateway before createSession or listSessions has cached the
     * type, so discover it by probing the draft endpoint and falling back to
     * the conversation endpoint. Concurrent callers share one probe.
     */
    async function probeSessionType(sessionId: string): Promise<boolean> {
        const inflight = sessionTypeProbes.get(sessionId);
        if (inflight != null) {
            return inflight;
        }
        const probe = (async () => {
            try {
                await privateClient.getDraftSession({ draftSessionId: sessionId });
                return true;
            } catch {
                await client.getSession({ sessionId });
                return false;
            }
        })();
        sessionTypeProbes.set(sessionId, probe);
        try {
            const isMutable = await probe;
            sessionTypeCache.set(sessionId, isMutable);
            return isMutable;
        } finally {
            sessionTypeProbes.delete(sessionId);
        }
    }

    async function getSessionObj(sessionId: string): Promise<GwSession> {
        const isMutable =
            sessionTypeCache.get(sessionId) ?? (await probeSessionType(sessionId));
        return isMutable
            ? privateClient.getDraftSession({ draftSessionId: sessionId })
            : client.getSession({ sessionId });
    }

    const server: TrueFoundryChatServer<TSpec> = {
        async createSession(req) {
            if (req.agentSpec != null) {
                const draft = await privateClient.createDraftSession({
                    agentSpec: req.agentSpec,
                    ...(req.agentName != null ? { agentName: req.agentName } : {}),
                    ...(req.tfyMetadata != null
                        ? { tfyMetadata: req.tfyMetadata }
                        : {}),
                });
                const session = toSession<TSpec>(draft);
                cacheSessionType(session);
                return session;
            }
            if (req.agentName != null) {
                const named = await client.createSession({
                    agentName: req.agentName,
                    ...(req.tfyMetadata != null
                        ? { tfyMetadata: req.tfyMetadata }
                        : {}),
                });
                const session = toSession<TSpec>(named);
                cacheSessionType(session);
                return session;
            }
            throw new Error("createSession requires agentName and/or agentSpec");
        },

        async listSessions(req) {
            const page = await privateClient.listOwnedSessions({
                limit: req?.limit,
                order: req?.order,
                pageToken: req?.pageToken,
                startTimestamp: req?.startTimestamp,
                endTimestamp: req?.endTimestamp,
                ...(req?.agentName != null ? { agentName: req.agentName } : {}),
            });
            const result = await toListResult(page, (s) => toSession<TSpec>(s));
            for (const session of result.data) {
                cacheSessionType(session);
            }
            return result;
        },

        async getSession({ sessionId }) {
            const raw = await getSessionObj(sessionId);
            const session = toSession<TSpec>(raw);
            cacheSessionType(session);
            return session;
        },

        async updateSession(req) {
            const raw = await getSessionObj(req.sessionId);
            if (!isDraft(raw)) {
                throw new Error(
                    "updateSession: session is not mutable (isMutable=false)",
                );
            }
            if (req.agentSpec != null) {
                await raw.update({ agentSpec: req.agentSpec });
            }
            return toSession<TSpec>(raw);
        },

        prepareAndExecuteTurn(req: {
            sessionId: string;
            input?: TurnInputItem[];
            previousTurnId?: PreviousTurnIdInput;
            abortSignal?: AbortSignal;
            headers?: Record<string, string>;
        }): AsyncIterable<TurnStreamData> {
            return (async function* () {
                const session = await getSessionObj(req.sessionId);
                const prepared = session.prepareTurn({
                    input: req.input,
                    previousTurnId: req.previousTurnId ?? "auto",
                });
                yield* prepared.execute(
                    { stream: true },
                    {
                        ...(req.abortSignal != null
                            ? { abortSignal: req.abortSignal }
                            : {}),
                        ...(req.headers != null ? { headers: req.headers } : {}),
                    },
                ) as AsyncIterable<TurnStreamData>;
            })();
        },

        async cancelSession({ sessionId }) {
            await (await getSessionObj(sessionId)).cancel();
        },

        async deleteSession({ sessionId }) {
            if (opts.deleteSession == null) {
                throw new Error(
                    "deleteSession is not on the gateway SDK. Pass deleteSession to createTrueFoundryChatServer.",
                );
            }
            await opts.deleteSession({ sessionId });
        },

        // The runtime's signature offers `order`, but the gateway's listTurns
        // takes no such param — forwarding it silently did nothing.
        async listTurns({ sessionId, limit, pageToken }) {
            const raw = await getSessionObj(sessionId);
            const page = await raw.listTurns({
                ...(limit != null ? { limit } : {}),
                ...(pageToken != null ? { pageToken } : {}),
            });
            return toListResult(page, (turn) => toTurn(turn));
        },

        async getTurn({ sessionId, turnId }) {
            const raw = await getSessionObj(sessionId);
            return toTurn(await raw.getTurn({ turnId }));
        },

        async listEvents({ sessionId, pageToken, lastTurnId, limit }) {
            const raw = await getSessionObj(sessionId);
            const page = await raw.listEvents({
                ...(limit != null ? { limit } : {}),
                ...(pageToken != null ? { pageToken } : {}),
                ...(lastTurnId != null ? { lastTurnId } : {}),
            });
            return toListResult(
                page,
                (item) => item as SessionEventItem,
            );
        },

        async listTurnEvents({ sessionId, turnId, limit, pageToken, order }) {
            const raw = await getSessionObj(sessionId);
            const turn = await raw.getTurn({ turnId });
            const page = await turn.listEvents({
                ...(limit != null ? { limit } : {}),
                ...(pageToken != null ? { pageToken } : {}),
                ...(order != null ? { order } : {}),
            });
            return toListResult(page, (event) => event as TurnEvent);
        },

        async *subscribeToTurn({
            sessionId,
            turnId,
            afterSequenceNumber,
            abortSignal,
        }) {
            const raw = await getSessionObj(sessionId);
            const turn = await raw.getTurn({ turnId });
            yield* turn.stream(
                afterSequenceNumber != null ? { afterSequenceNumber } : {},
                abortSignal != null ? { abortSignal } : {},
            ) as AsyncIterable<TurnStreamData>;
        },

        async downloadSandboxFile(sandboxId, req) {
            const response = await privateClient.downloadSandboxFile(
                sandboxId,
                req,
            );
            return await response.blob();
        },

        getGatewayClients: () => ({ client, privateClient }),
    };

    return server;
}
