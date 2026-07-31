import { createTrueFoundryChatServer } from "@truefoundry/agent-server-adapter";
import type { AgentChatServer } from "@truefoundry/assistant-ui-runtime";

import type { GatewayCredentials } from "./credentials";

let server: AgentChatServer | undefined;
let serverCredentialsKey: string | undefined;

function credentialsKey(credentials: GatewayCredentials): string {
  return `${credentials.apiKey}:${credentials.gatewayUrl}`;
}

export function getAgentChatServer(
  credentials: GatewayCredentials,
): AgentChatServer {
  const key = credentialsKey(credentials);
  if (server != null && serverCredentialsKey === key) {
    return server;
  }

  server = createTrueFoundryChatServer({
    apiKey: credentials.apiKey,
    baseUrl: credentials.gatewayUrl,
  });
  serverCredentialsKey = key;
  return server;
}
