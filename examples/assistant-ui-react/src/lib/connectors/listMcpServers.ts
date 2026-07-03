import { cpFetch } from "@/lib/auth/cpFetch";

export interface ConnectorState {
    id: string;
    name: string;
    mcpName: string;
    serverId: string | null;
    authenticated: boolean;
    perUser: boolean;
    description?: string;
    noAuthUi: boolean;
}

interface RawAuthStatus {
    status?: string;
    method?: string;
    message?: string;
}

interface RawMcpManifest {
    description?: string;
    auth_data?: {
        type?: string;
        auth_level?: "per_user" | "shared";
    };
}

interface RawMcpServer {
    id?: string;
    name?: string;
    fqn?: string;
    manifest?: RawMcpManifest | string;
    authStatus?: RawAuthStatus;
}

function parseManifest(raw: RawMcpServer["manifest"]): RawMcpManifest {
    if (raw == null) return {};
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as RawMcpManifest;
        } catch {
            return {};
        }
    }
    return raw;
}

function normalizeConnector(row: RawMcpServer): ConnectorState | null {
    const mcpName = row.name?.trim();
    if (!mcpName) return null;

    const manifest = parseManifest(row.manifest);
    const authData = manifest.auth_data;
    const authStatus = row.authStatus?.status ?? "unauthenticated";
    const authenticated = authStatus !== "unauthenticated";
    const perUser = authData?.auth_level === "per_user";
    const authType = authData?.type;
    const noAuthUi =
        authData == null ||
        authType === "passthrough" ||
        (authType === "header" && authData.auth_level === "shared");

    return {
        id: mcpName,
        name: mcpName,
        mcpName,
        serverId: row.id ?? null,
        authenticated: noAuthUi || authenticated,
        perUser,
        description: manifest.description,
        noAuthUi,
    };
}

export async function listMcpServers(
    cpUrl: string,
    token: string,
): Promise<ConnectorState[]> {
    const response = await cpFetch(`${cpUrl}/api/svc/v1/mcp-servers`, token);
    if (!response.ok) {
        throw new Error(`Failed to list MCP servers (${response.status})`);
    }

    const json = (await response.json()) as { data?: RawMcpServer[] };
    const rows = json.data ?? [];
    const seen = new Set<string>();
    const connectors: ConnectorState[] = [];

    for (const row of rows) {
        const connector = normalizeConnector(row);
        if (connector == null || seen.has(connector.mcpName)) continue;
        seen.add(connector.mcpName);
        connectors.push(connector);
    }

    return connectors.sort((a, b) => a.name.localeCompare(b.name));
}

export type McpAuthorizeResult =
    | { status: "authenticated" | "authentication_not_required" }
    | { status: "authentication_required"; authorizationUrl: string };

export async function authorizeMcpServer(
    cpUrl: string,
    token: string,
    serverId: string,
    gatewayBaseUrl?: string,
): Promise<McpAuthorizeResult> {
    const params = new URLSearchParams();
    if (gatewayBaseUrl) {
        params.set("gatewayBaseURL", gatewayBaseUrl);
    }
    const query = params.size > 0 ? `?${params.toString()}` : "";
    const response = await cpFetch(
        `${cpUrl}/api/svc/v1/mcp/${serverId}/authorize${query}`,
        token,
    );
    if (!response.ok) {
        throw new Error(`Failed to authorize MCP server (${response.status})`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const status = String(json.status ?? "");

    if (status === "authenticated" || status === "authentication_not_required") {
        return { status };
    }

    const authorizationUrl =
        pickString(json.authorization_endpoint) ??
        pickString(json.authorizationEndpoint) ??
        pickString(json.consentUrl) ??
        pickString(json.consent_url) ??
        pickString(json.authorizationUrl) ??
        pickString(json.authorization_url) ??
        pickString(json.url);

    if (authorizationUrl) {
        return { status: "authentication_required", authorizationUrl };
    }

    throw new Error("Authorization required but no consent URL was returned.");
}

function pickString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
