import type { AuthMode } from "@/lib/auth/types";

export function getControlPlaneUrl(): string {
    const url = process.env.NEXT_PUBLIC_TF_CP_URL;
    if (!url) {
        throw new Error(
            "NEXT_PUBLIC_TF_CP_URL is not set. Configure it in .env.local (see .env.example).",
        );
    }
    return url.replace(/\/+$/, "");
}

export function getAgentModeEnv(): string {
    return process.env.NEXT_PUBLIC_AGENT_MODE ?? "STANDALONE";
}

export function detectAuthMode(): AuthMode {
    return getAgentModeEnv() === "STANDALONE" ? "device" : "cookie";
}

/**
 * The tenant-id / session probes resolve a tenant from the control-plane's
 * own hostname (e.g. a tenant-specific CP subdomain), not the hostname the
 * frontend happens to be served from — those differ in local dev.
 */
export function getControlPlaneHostname(cpUrl: string): string {
    return new URL(cpUrl).hostname;
}
