import type { AuthMode } from "@/lib/auth/types";

let currentMode: AuthMode = "device";

export function setAuthMode(mode: AuthMode): void {
    currentMode = mode;
}

export function getAuthMode(): AuthMode {
    return currentMode;
}

export async function cpFetch(
    url: string,
    token: string | null | undefined,
    init: RequestInit & { jsonBody?: unknown } = {},
): Promise<Response> {
    const { jsonBody, headers: rawHeaders, ...rest } = init;
    const headers: Record<string, string> = {
        ...(rawHeaders as Record<string, string> | undefined),
    };
    if (jsonBody !== undefined && !headers["content-type"]) {
        headers["content-type"] = "application/json";
    }

    const useCookies = currentMode === "cookie";
    if (!useCookies && token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return fetch(url, {
        ...rest,
        headers,
        credentials: useCookies ? "include" : (rest.credentials ?? "same-origin"),
        body: jsonBody !== undefined ? JSON.stringify(jsonBody) : rest.body,
    });
}
