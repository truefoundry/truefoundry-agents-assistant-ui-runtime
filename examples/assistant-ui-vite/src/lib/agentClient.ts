import {
  createTrueFoundryServer,
  type AgentChatServer,
  type TrueFoundryServer,
} from "@truefoundry/agent-ui-sdk";
import { createTrueFoundryChatServer } from "@truefoundry/assistant-ui-runtime/plugins/truefoundry-agent-server-adapter";

import type { GatewayCredentials } from "./credentials";

let server: TrueFoundryServer | undefined;
let serverCredentialsKey: string | undefined;

function credentialsKey(credentials: GatewayCredentials): string {
  return `${credentials.apiKey}:${credentials.gatewayUrl}`;
}

/**
 * Named-agent demo server: chat via the gateway adapter, builder catalog stubs
 * (Agents Library is locked off when `agentName` is passed to the UI).
 *
 * Cast: gateway `TfyAgentSpec` widens FE `AgentSpec`; createSession is
 * contravariant on that, so TS won't unify the adapter with the SDK base.
 */
export function getAgentUIServer(
  credentials: GatewayCredentials,
): TrueFoundryServer {
  const key = credentialsKey(credentials);
  if (server != null && serverCredentialsKey === key) {
    return server;
  }

  const chatServer = createTrueFoundryChatServer({
    apiKey: credentials.apiKey,
    baseUrl: credentials.gatewayUrl,
  });

  server = createTrueFoundryServer({
    chatServer: chatServer as unknown as AgentChatServer,
    getModels: async () => [],
    getSkills: async () => [],
    getMcp: async () => [],
    searchAgents: async () => [],
    saveAgent: async () => ({ ok: true as const }),
  });
  serverCredentialsKey = key;
  return server;
}
