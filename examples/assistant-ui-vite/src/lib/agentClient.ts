import { AgentSessionClient } from "truefoundry-gateway-sdk/agents";

import type { GatewayCredentials } from "./credentials";

let client: AgentSessionClient | undefined;
let clientCredentialsKey: string | undefined;

function credentialsKey(credentials: GatewayCredentials): string {
  return `${credentials.apiKey}:${credentials.gatewayUrl}`;
}

export function getAgentSessionClient(
  credentials: GatewayCredentials,
): AgentSessionClient {
  const key = credentialsKey(credentials);
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
