import { AgentSessionClient } from "truefoundry-gateway-sdk/agents";
import type { AgentSession } from "truefoundry-gateway-sdk/agents";
import { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";
import type { AgentDraftSession } from "truefoundry-gateway-sdk/agents/private";
import type {
    AgentChatServer,
    AgentSpec,
    ListResult,
    Session,
    Turn,
    TurnEvent,
    TurnInputItem,
    TurnStreamData,
    PreviousTurnIdInput,
    SessionEventItem,
} from "@truefoundry/assistant-ui-runtime";

type GwSession = AgentSession | AgentDraftSession;

export type CreateTrueFoundryChatServerOptions = {
    apiKey: string;
    baseUrl: string;
    /** Optional override — otherwise constructed from apiKey/baseUrl. */
    client?: AgentSessionClient;
    privateClient?: PrivateAgentSessionClient;
    deleteSession?: (req: { sessionId: string }) => Promise<void>;
};

export type TrueFoundryChatServer = AgentChatServer & {
    /** Escape hatch for hosts that still need raw gateway clients. */
    getGatewayClients(): {
        client: AgentSessionClient;
        privateClient: PrivateAgentSessionClient;
    };
};

function isDraft(session: GwSession): session is AgentDraftSession {
    return (session as AgentDraftSession).type === "session/draft";
}

function toSession(raw: GwSession): Session {
    const mutable = isDraft(raw);
    return {
        id: raw.id,
        title: raw.title,
        agentName: raw.agentName,
        ...(mutable ? { agentSpec: raw.agentSpec as AgentSpec } : {}),
        isMutable: mutable,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    };
}

function toTurn(raw: {
    id: string;
    sessionId: string;
    previousTurnId?: string | null;
    input?: TurnInputItem[];
    state: Turn["state"];
    createdAt: string;
}): Turn {
    return {
        id: raw.id,
        sessionId: raw.sessionId,
        previousTurnId: raw.previousTurnId,
        input: raw.input as TurnInputItem[] | undefined,
        state: raw.state as Turn["state"],
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
 * to call. No try/catch fallback, no double network calls.
 */
export function createTrueFoundryChatServer(
    opts: CreateTrueFoundryChatServerOptions,
): TrueFoundryChatServer {
    const gatewayOpts = { apiKey: opts.apiKey, baseUrl: opts.baseUrl };
    const client = opts.client ?? new AgentSessionClient(gatewayOpts);
    const privateClient =
        opts.privateClient ?? new PrivateAgentSessionClient(gatewayOpts);

    const sessionTypeCache = new Map<string, boolean>();

    function cacheSessionType(session: Session): void {
        sessionTypeCache.set(session.id, session.isMutable);
    }

    function getSessionObj(sessionId: string): Promise<GwSession> {
        const isMutable = sessionTypeCache.get(sessionId);
        if (isMutable === true) {
            return privateClient.getDraftSession({ draftSessionId: sessionId });
        }
        if (isMutable === false) {
            return client.getSession({ sessionId });
        }
        throw new Error(
            `Cannot resolve session "${sessionId}": session type not cached. ` +
                `Ensure createSession or listSessions was called first.`,
        );
    }

    const server: TrueFoundryChatServer = {
        async createSession(req) {
            if (req.agentSpec != null) {
                const draft = await privateClient.createDraftSession({
                    agentSpec: req.agentSpec as never,
                    ...(req.agentName != null ? { agentName: req.agentName } : {}),
                });
                const session = toSession(draft);
                cacheSessionType(session);
                return session;
            }
            if (req.agentName != null) {
                const named = await client.createSession({
                    agentName: req.agentName,
                });
                const session = toSession(named);
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
                ...(req?.agentName != null ? { agentName: req.agentName } : {}),
            });
            const result = await toListResult(page, toSession);
            for (const session of result.data) {
                cacheSessionType(session);
            }
            return result;
        },

        async getSession({ sessionId }) {
            const raw = await getSessionObj(sessionId);
            const session = toSession(raw);
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
                await raw.update({ agentSpec: req.agentSpec as never });
            }
            return toSession(raw);
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

        async listTurns({ sessionId, limit, pageToken, order }) {
            const raw = await getSessionObj(sessionId);
            const page = await raw.listTurns({
                ...(limit != null ? { limit } : {}),
                ...(pageToken != null ? { pageToken } : {}),
                ...(order != null ? { order } : {}),
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
