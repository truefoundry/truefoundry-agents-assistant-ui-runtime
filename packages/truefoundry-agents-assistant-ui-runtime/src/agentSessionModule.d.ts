declare module "truefoundry-gateway-sdk/dist/esm/agents/AgentSession.mjs" {
    import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";
    import type * as TrueFoundryGatewayApi from "truefoundry-gateway-sdk";
    import type { PreparedTurn } from "truefoundry-gateway-sdk/agents";
    import type * as core from "truefoundry-gateway-sdk/core";

    export class AgentSession implements TrueFoundryGatewayApi.Session {
        readonly id: string;
        readonly agentName: string;
        readonly title?: string;
        readonly createdBySubject: TrueFoundryGatewayApi.Subject;
        readonly createdAt: string;
        readonly updatedAt: string;
        constructor(session: TrueFoundryGatewayApi.Session, client: TrueFoundryGateway);
        prepareTurn(opts?: {
            input?: TrueFoundryGatewayApi.TurnInputItem[];
            previousTurnId?: TrueFoundryGatewayApi.PreviousTurnIdInput;
        }): PreparedTurn;
        listTurns(
            opts?: TrueFoundryGatewayApi.agents.SessionsListTurnsRequest,
            requestOptions?: unknown,
        ): Promise<core.Page<unknown, TrueFoundryGatewayApi.ListTurnsResponse>>;
        /**
         * Paginated session events across turns (newest first); subscribe to a
         * running turn for live events.
         *
         * @param opts.lastTurnId - Newest turn in the listing window (initial load only).
         *   Omit to use the session last turn. Running-turn events are excluded.
         */
        listEvents(
            opts?: TrueFoundryGatewayApi.agents.SessionsListEventsRequest,
            requestOptions?: unknown,
        ): Promise<core.Page<TrueFoundryGatewayApi.SessionEventItem, TrueFoundryGatewayApi.ListSessionEventsResponse>>;
        getTurn(opts: { turnId: string }, requestOptions?: unknown): Promise<unknown>;
        cancel(requestOptions?: unknown): Promise<void>;
    }
}
