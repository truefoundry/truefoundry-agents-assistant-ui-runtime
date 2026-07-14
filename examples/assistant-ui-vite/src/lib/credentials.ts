export type GatewayCredentials = {
  apiKey: string;
  gatewayUrl: string;
  agentName: string;
};

export function loadCredentials(): GatewayCredentials | null {
  const apiKey = import.meta.env.VITE_TFY_API_KEY?.trim();
  const gatewayUrl = import.meta.env.VITE_TFY_GATEWAY_URL?.trim();
  const agentName = import.meta.env.VITE_TFY_AGENT_NAME?.trim();

  if (!apiKey || !gatewayUrl || !agentName) {
    return null;
  }

  return { apiKey, gatewayUrl, agentName };
}
