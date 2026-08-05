export type GatewayCredentials = {
  apiKey: string;
  /**
   * Control Plane base for the client.
   * In Vite `dev`, this is `""` (same-origin) so requests go through the
   * Vite proxy to `VITE_TFY_CP_URL`. In production builds, the full CP URL.
   */
  cpURL: string;
  /** Optional gateway override. When omitted, resolved via CP `/session`. */
  gatewayURL?: string;
  /** Optional — omit to unlock Agents Library / draft builder in the UI. */
  agentName?: string;
};

export function loadCredentials(): GatewayCredentials | null {
  const apiKey = import.meta.env.VITE_TFY_API_KEY?.trim();
  const cpTarget = import.meta.env.VITE_TFY_CP_URL?.trim();
  const gatewayURL = import.meta.env.VITE_TFY_GATEWAY_URL?.trim() || undefined;
  const agentName = import.meta.env.VITE_TFY_AGENT_NAME?.trim() || undefined;

  if (!apiKey || !cpTarget) {
    return null;
  }

  return {
    apiKey,
    // Dev: same-origin → Vite proxies /api/* to VITE_TFY_CP_URL (avoids CORS).
    cpURL: import.meta.env.DEV ? "" : cpTarget,
    ...(gatewayURL != null ? { gatewayURL } : {}),
    ...(agentName != null ? { agentName } : {}),
  };
}
