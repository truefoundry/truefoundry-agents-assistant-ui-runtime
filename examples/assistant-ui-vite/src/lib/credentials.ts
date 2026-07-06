export type GatewayCredentials = {
  apiKey: string;
  gatewayUrl: string;
  agentName: string;
};

const STORAGE_KEY = "tfy-agent-credentials";

export function loadCredentials(): GatewayCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<GatewayCredentials>;
    if (
      typeof parsed.apiKey !== "string" ||
      parsed.apiKey.trim() === "" ||
      typeof parsed.gatewayUrl !== "string" ||
      parsed.gatewayUrl.trim() === "" ||
      typeof parsed.agentName !== "string" ||
      parsed.agentName.trim() === ""
    ) {
      return null;
    }
    return {
      apiKey: parsed.apiKey.trim(),
      gatewayUrl: parsed.gatewayUrl.trim(),
      agentName: parsed.agentName.trim(),
    };
  } catch {
    return null;
  }
}

export function saveCredentials(credentials: GatewayCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}
