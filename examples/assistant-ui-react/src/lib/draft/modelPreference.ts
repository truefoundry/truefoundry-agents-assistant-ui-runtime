import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

const STORAGE_KEY = "tfy-draft-model-preference";

/** Reads the user's last explicitly selected model (+ params) for new draft chats. */
export function getStoredModelPreference(): AgentSpec["model"] | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as AgentSpec["model"];
        if (!parsed?.name) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function setStoredModelPreference(model: AgentSpec["model"]): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
    } catch {
        // Ignore storage failures (private browsing, quota, etc.)
    }
}
