import { cpFetch } from "@/lib/auth/cpFetch";
import type {
    DeviceAuthorizeResponse,
    StoredAuth,
    TokenResponse,
} from "@/lib/auth/types";

function decodeJwtExpiry(jwt: string): number {
    const payload = jwt.split(".")[1];
    if (!payload) {
        throw new Error("Malformed JWT: missing payload segment.");
    }
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof json.exp !== "number") {
        throw new Error("Malformed JWT: missing exp claim.");
    }
    return json.exp;
}

export async function resolveTenantName(
    cpUrl: string,
    host: string,
): Promise<string> {
    const res = await cpFetch(
        `${cpUrl}/api/svc/v1/tenant-id?hostName=${encodeURIComponent(host)}`,
        null,
    );
    if (!res.ok) {
        throw new Error(`Failed to resolve tenant name (${res.status}).`);
    }
    const json = (await res.json()) as { tenant_name?: string; tenantName?: string };
    const tenantName = json.tenant_name ?? json.tenantName;
    if (!tenantName) {
        throw new Error("Tenant-id response did not include a tenant name.");
    }
    return tenantName;
}

export async function requestDeviceAuthorize(
    cpUrl: string,
    tenantName: string,
): Promise<DeviceAuthorizeResponse> {
    const res = await cpFetch(`${cpUrl}/api/svc/v1/oauth2/device-authorize`, null, {
        method: "POST",
        jsonBody: { tenantName },
    });
    if (!res.ok) {
        throw new Error(`Failed to start device authorization (${res.status}).`);
    }
    return (await res.json()) as DeviceAuthorizeResponse;
}

async function requestToken(
    cpUrl: string,
    body: Record<string, unknown>,
): Promise<TokenResponse | null> {
    const res = await cpFetch(`${cpUrl}/api/svc/v1/oauth2/token`, null, {
        method: "POST",
        jsonBody: { ...body, returnJWT: true },
    });
    if (res.status === 202) {
        return null;
    }
    if (!res.ok) {
        throw new Error(`Failed to fetch token (${res.status}).`);
    }
    return (await res.json()) as TokenResponse;
}

export interface PollForTokenOptions {
    cpUrl: string;
    tenantName: string;
    deviceCode: string;
    intervalSeconds: number;
    expiresInSeconds: number;
    signal?: AbortSignal;
}

export async function pollForToken(
    options: PollForTokenOptions,
): Promise<TokenResponse> {
    const { cpUrl, tenantName, deviceCode, intervalSeconds, expiresInSeconds, signal } =
        options;
    const deadline = Date.now() + expiresInSeconds * 1000;

    while (Date.now() < deadline) {
        if (signal?.aborted) {
            throw new DOMException("Device authorization cancelled.", "AbortError");
        }
        const token = await requestToken(cpUrl, {
            tenantName,
            deviceCode,
            grantType: "device_code",
        });
        if (token != null) {
            return token;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
    }

    throw new Error("Device authorization expired before approval.");
}

export async function refreshAccessToken(
    cpUrl: string,
    tenantName: string,
    refreshToken: string,
): Promise<TokenResponse> {
    const token = await requestToken(cpUrl, {
        tenantName,
        refreshToken,
        grantType: "refresh_token",
    });
    if (token == null) {
        throw new Error("Refresh-token response was unexpectedly pending.");
    }
    return token;
}

export function toStoredAuth(
    cpUrl: string,
    tenantName: string,
    token: TokenResponse,
): StoredAuth {
    return {
        controlPlaneUrl: cpUrl,
        tenantName,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: decodeJwtExpiry(token.accessToken),
    };
}

export function isExpired(auth: StoredAuth): boolean {
    return Date.now() / 1000 >= auth.expiresAt;
}

export function scheduleRefresh(
    auth: StoredAuth,
    onRefreshed: (auth: StoredAuth) => void,
    onError: (error: unknown) => void,
): () => void {
    const delayMs = Math.max((auth.expiresAt - 120 - Date.now() / 1000) * 1000, 0);
    const timer = setTimeout(async () => {
        if (!auth.refreshToken) {
            onError(new Error("Session expired and no refresh token is available."));
            return;
        }
        try {
            const token = await refreshAccessToken(
                auth.controlPlaneUrl,
                auth.tenantName,
                auth.refreshToken,
            );
            const refreshed = toStoredAuth(auth.controlPlaneUrl, auth.tenantName, token);
            onRefreshed(refreshed);
        } catch (error) {
            onError(error);
        }
    }, delayMs);
    return () => clearTimeout(timer);
}
