import {
  createTrueFoundryAgentUIServer,
  type TrueFoundryAgentUIServer,
} from "@truefoundry/assistant-ui-runtime/plugins/truefoundry-agent-server-adapter";
import type { TrueFoundryServer } from "@truefoundry/agent-ui-sdk";

import type { GatewayCredentials } from "./credentials";

let server: TrueFoundryServer | undefined;
let serverCredentialsKey: string | undefined;
let inflight: Promise<TrueFoundryServer> | undefined;

function credentialsKey(credentials: GatewayCredentials): string {
  return `${credentials.apiKey}:${credentials.cpURL}:${credentials.gatewayURL ?? ""}`;
}

/**
 * Full pack via createTrueFoundryAgentUIServer.
 * Cast once: TfyAgentSpec widens FE AgentSpec; UI props won't unify cleanly.
 */
export async function getAgentUIServer(
  credentials: GatewayCredentials,
): Promise<TrueFoundryServer> {
  const key = credentialsKey(credentials);
  if (server != null && serverCredentialsKey === key) {
    return server;
  }
  if (inflight != null && serverCredentialsKey === key) {
    return inflight;
  }

  serverCredentialsKey = key;
  inflight = (async () => {
    const pack: TrueFoundryAgentUIServer = await createTrueFoundryAgentUIServer({
      apiKey: credentials.apiKey,
      cpURL: credentials.cpURL,
      ...(credentials.gatewayURL != null
        ? { gatewayURL: credentials.gatewayURL }
        : {}),
    });
    server = pack as unknown as TrueFoundryServer;
    return server;
  })();

  try {
    return await inflight;
  } finally {
    inflight = undefined;
  }
}
