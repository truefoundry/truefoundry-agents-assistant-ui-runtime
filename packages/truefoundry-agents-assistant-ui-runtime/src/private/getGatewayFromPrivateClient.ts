import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";
import type { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";

/** Reach the underlying gateway for APIs not yet wrapped on PrivateAgentSessionClient (update, sandbox download). */
export function getGatewayFromPrivateClient(
    privateClient: PrivateAgentSessionClient,
): TrueFoundryGateway {
    const internal = privateClient as unknown as { client: TrueFoundryGateway };
    if (internal.client == null) {
        throw new Error("PrivateAgentSessionClient is missing an internal gateway client.");
    }
    return internal.client;
}
