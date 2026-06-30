import { AgentSessionClient } from "truefoundry-gateway-sdk/agents";

import type { GatewayCredentials } from "@/lib/chat/gatewayCredentials";

let client: AgentSessionClient | undefined;
let clientCredentialsKey: string | undefined;

export function getAgentSessionClient(
    credentials: GatewayCredentials,
): AgentSessionClient {
    const key = `${credentials.apiKey}:${credentials.gatewayUrl}`;
    if (client != null && clientCredentialsKey === key) {
        return client;
    }
    client = new AgentSessionClient({
        apiKey: credentials.apiKey,
        baseUrl: credentials.gatewayUrl,
    });
    clientCredentialsKey = key;
    return client;
}
