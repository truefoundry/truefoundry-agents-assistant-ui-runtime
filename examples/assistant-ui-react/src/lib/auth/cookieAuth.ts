import { cpFetch } from "@/lib/auth/cpFetch";
import { setInMemoryPat } from "@/lib/auth/storage";
import type { SessionProbeResponse } from "@/lib/auth/types";

export async function probeSession(
    cpUrl: string,
    host: string,
    cachedTenantName: string,
): Promise<SessionProbeResponse> {
    const params = new URLSearchParams({
        hostName: host,
        tenantName: cachedTenantName,
        includeTenantInfo: "true",
    });
    const res = await cpFetch(`${cpUrl}/api/svc/v1/session?${params}`, null);
    if (res.status === 401 || res.status === 403) {
        return { user: null };
    }
    if (!res.ok) {
        throw new Error(`Failed to probe session (${res.status}).`);
    }
    return (await res.json()) as SessionProbeResponse;
}

export function bounceToSignIn(cpUrl: string, redirectPath: string): void {
    window.location.href = `${cpUrl}/signin/external?redirectPath=${encodeURIComponent(redirectPath)}`;
}

function extractPat(json: unknown): string | null {
    if (json == null || typeof json !== "object") return null;
    const obj = json as Record<string, unknown>;
    const direct = obj.value ?? obj.token ?? obj.accessToken;
    if (typeof direct === "string") return direct;
    const data = obj.data;
    if (data != null && typeof data === "object") {
        const nested = data as Record<string, unknown>;
        const value = nested.value ?? nested.token ?? nested.accessToken;
        if (typeof value === "string") return value;
    }
    return null;
}

export async function fetchPersonalAccessToken(
    cpUrl: string,
    userId: string,
): Promise<string> {
    const res = await cpFetch(
        `${cpUrl}/api/svc/v1/personal-access-tokens/default-${userId}`,
        null,
    );
    if (!res.ok) {
        throw new Error(`Failed to fetch personal access token (${res.status}).`);
    }
    const json: unknown = await res.json();
    const pat = extractPat(json);
    if (!pat) {
        throw new Error("Personal-access-token response did not include a token value.");
    }
    setInMemoryPat(pat);
    return pat;
}

export async function logout(cpUrl: string, tenantName: string): Promise<void> {
    setInMemoryPat(null);

    const params = new URLSearchParams({ tenantName, redirectURL: cpUrl });
    const res = await cpFetch(`${cpUrl}/api/svc/v1/oauth2/logout?${params}`, null);
    if (!res.ok) {
        window.location.href = cpUrl;
        return;
    }
    const json = (await res.json()) as { logoutURL?: string };
    window.location.href = json.logoutURL ?? cpUrl;
}
