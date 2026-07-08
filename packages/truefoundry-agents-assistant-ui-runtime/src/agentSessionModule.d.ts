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
        ): Promise<core.Page<unknown, TrueFoundryGatewayApi.ListTurnsResponse>>;
        listEvents(
            opts?: TrueFoundryGatewayApi.agents.SessionsListEventsRequest,
        ): Promise<core.Page<TrueFoundryGatewayApi.SessionEventItem, TrueFoundryGatewayApi.ListSessionEventsResponse>>;
        getTurn(opts: { turnId: string }): Promise<unknown>;
        cancel(): Promise<void>;
    }
}
