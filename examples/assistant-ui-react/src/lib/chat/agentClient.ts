import { AgentSessionClient } from "truefoundry-gateway-sdk/agents";
import { TrueFoundryGateway } from "truefoundry-gateway-sdk";

import type { GatewayCredentials } from "@/lib/chat/gatewayCredentials";

let client: AgentSessionClient | undefined;
let gateway: TrueFoundryGateway | undefined;
let clientCredentialsKey: string | undefined;

function credentialsKey(credentials: GatewayCredentials): string {
    return `${credentials.apiKey}:${credentials.gatewayUrl}`;
}

function createClients(credentials: GatewayCredentials) {
    const options = {
        apiKey: credentials.apiKey,
        baseUrl: credentials.gatewayUrl,
    };
    return {
        client: new AgentSessionClient(options),
        gateway: new TrueFoundryGateway(options),
    };
}

export function getAgentSessionClient(
    credentials: GatewayCredentials,
): AgentSessionClient {
    const key = credentialsKey(credentials);
    if (client != null && clientCredentialsKey === key) {
        return client;
    }
    const created = createClients(credentials);
    client = created.client;
    gateway = created.gateway;
    clientCredentialsKey = key;
    return client;
}

export function getGatewayClient(credentials: GatewayCredentials): TrueFoundryGateway {
    const key = credentialsKey(credentials);
    if (gateway != null && clientCredentialsKey === key) {
        return gateway;
    }
    const created = createClients(credentials);
    client = created.client;
    gateway = created.gateway;
    clientCredentialsKey = key;
    return gateway;
}
