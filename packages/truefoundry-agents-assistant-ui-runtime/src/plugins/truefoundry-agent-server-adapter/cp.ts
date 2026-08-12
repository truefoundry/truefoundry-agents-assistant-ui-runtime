/**
 * Control Plane HTTP for builder catalog lists + gateway URL resolution.
 *
 * Wire shapes are host/CP contracts (not Fern / gateway SDK). Paths match
 * ai.tf cpApi usage — expect drift; keep normalizers defensive.
 */

import type {
    AgentSelectorEntry,
    ConnectorSelectorEntry,
    ModelSelectorEntry,
    SaveAgentRequest,
    SearchAgentSelectorParams,
    SkillSelectorEntry,
} from "../../server/types.js";
import { normalizeAgentSpecForGateway } from "./normalizeAgentSpec.js";
import type { TfyAgentSpec } from "./types.js";

// ---------------------------------------------------------------------------
// Selector rows — FE base + TFY mount fields
// ---------------------------------------------------------------------------

export interface TfyModelSelectorEntry extends ModelSelectorEntry {
    /** Write into AgentSpec.model.name (model_fqn). */
    apiModel: string;
    modelId: string;
    providerAccount?: string;
}

export interface TfySkillSelectorEntry extends SkillSelectorEntry {
    /** Version FQN — mount as RegisteredSkillMount.fqn. */
    fqn: string;
}

export interface TfyConnectorSelectorEntry extends ConnectorSelectorEntry {
    /** Mount as RegisteredMcpServer.name. */
    mcpName: string;
    serverId?: string | null;
    authenticated?: boolean;
}

export type TfyAgentSelectorEntry = AgentSelectorEntry;

export type CpCredentials = {
    apiKey: string;
    cpURL: string;
};

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function trimSlash(url: string): string {
    return url.replace(/\/+$/, "");
}

export async function cpFetch<T>(
    opts: CpCredentials,
    path: string,
    init?: RequestInit,
): Promise<T> {
    const url = `${trimSlash(opts.cpURL)}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
        ...init,
        headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            Accept: "application/json",
            ...(init?.headers ?? {}),
        },
    });
    if (!res.ok) {
        throw new Error(`CP ${res.status} ${res.statusText}: ${path}`);
    }
    return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Gateway URL resolve
// ---------------------------------------------------------------------------

/**
 * Real CP `/api/svc/v1/session` is flat `{ user, env, ... }` (no `data` wrapper).
 * `env.LLM_GATEWAY_URL` is a prefix like `/api/llm`; tenant is appended:
 * `{cpURL}{LLM_GATEWAY_URL}/{tenantName}` → e.g. `…/api/llm/truefoundry`.
 */
type SessionResponse = {
    user?: {
        tenantName?: string;
    };
    env?: {
        TENANT_NAME?: string;
        LLM_GATEWAY_URL?: string;
    };
    /** Legacy / alternate wrap — keep for safety. */
    data?: {
        user?: {
            tenantName?: string;
        };
    };
};

function joinCpPath(cpURL: string, path: string): string {
    const base = trimSlash(cpURL);
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
}

/**
 * Resolve gateway base URL.
 * - `gatewayURL` set → use it (no /session).
 * - else GET /api/svc/v1/session →
 *   `{cpURL}{env.LLM_GATEWAY_URL ?? "/api/llm"}/{tenantName}`.
 * - session HTTP failure or missing tenantName → throw (no silent public fallback).
 */
export async function resolveGatewayURL(opts: {
    apiKey: string;
    cpURL: string;
    gatewayURL?: string;
}): Promise<string> {
    if (opts.gatewayURL != null && opts.gatewayURL !== "") {
        return opts.gatewayURL;
    }

    const session = await cpFetch<SessionResponse>(opts, "/api/svc/v1/session");
    const tenantName =
        session.user?.tenantName ??
        session.env?.TENANT_NAME ??
        session.data?.user?.tenantName;
    if (tenantName == null || tenantName === "") {
        throw new Error(
            "resolveGatewayURL: /api/svc/v1/session did not return user.tenantName",
        );
    }

    const llmPrefix = trimSlash(session.env?.LLM_GATEWAY_URL ?? "/api/llm");
    return joinCpPath(opts.cpURL, `${llmPrefix}/${tenantName}`);
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

type RawEnabledModel = {
    id?: string;
    name?: string;
    provider?: string;
    provider_account_name?: string;
    model_id?: string;
    model_fqn?: string;
    types?: string[];
};

function isChatModel(row: RawEnabledModel): boolean {
    const types = row.types;
    if (types == null || types.length === 0) return true;
    return types.includes("chat");
}

function toModelEntry(row: RawEnabledModel): TfyModelSelectorEntry | null {
    if (!isChatModel(row)) return null;
    const apiModel = row.model_fqn ?? row.id;
    const name = row.name;
    if (apiModel == null || apiModel === "" || name == null || name === "") {
        return null;
    }
    const modelId = row.model_id ?? name;
    return {
        id: apiModel,
        name,
        provider: { name: row.provider ?? "unknown" },
        properties: {},
        apiModel,
        modelId,
        ...(row.provider_account_name != null
            ? { providerAccount: row.provider_account_name }
            : {}),
    };
}

/**
 * Flatten enabled-models payload.
 * Nested: provider → account → models[].
 * Virtual: top-level account → models[] (array values that look like model rows).
 */
export function normalizeEnabledModels(raw: unknown): TfyModelSelectorEntry[] {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
        return [];
    }
    const out: TfyModelSelectorEntry[] = [];
    const seen = new Set<string>();

    function pushRow(row: RawEnabledModel): void {
        const entry = toModelEntry(row);
        if (entry == null || seen.has(entry.apiModel)) return;
        seen.add(entry.apiModel);
        out.push(entry);
    }

    for (const level1 of Object.values(raw as Record<string, unknown>)) {
        if (Array.isArray(level1)) {
            // virtual-model style: account → models[]
            for (const row of level1) {
                if (row != null && typeof row === "object") {
                    pushRow(row as RawEnabledModel);
                }
            }
            continue;
        }
        if (level1 == null || typeof level1 !== "object") continue;
        for (const level2 of Object.values(level1 as Record<string, unknown>)) {
            if (!Array.isArray(level2)) continue;
            for (const row of level2) {
                if (row != null && typeof row === "object") {
                    pushRow(row as RawEnabledModel);
                }
            }
        }
    }
    return out;
}

export async function listEnabledModels(
    opts: CpCredentials,
): Promise<TfyModelSelectorEntry[]> {
    const raw = await cpFetch<unknown>(
        opts,
        "/api/svc/v1/llm-gateway/model/enabled",
    );
    return normalizeEnabledModels(raw);
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

type RawAgentSkill = {
    id?: string;
    name?: string;
    fqn?: string;
    latest_version?: {
        id?: string;
        fqn?: string;
        manifest?: {
            ml_repo?: string;
            source?: { description?: string };
        };
    };
};

export function normalizeAgentSkills(raw: unknown): TfySkillSelectorEntry[] {
    const data =
        raw != null &&
        typeof raw === "object" &&
        Array.isArray((raw as { data?: unknown }).data)
            ? ((raw as { data: RawAgentSkill[] }).data)
            : [];
    const out: TfySkillSelectorEntry[] = [];
    for (const row of data) {
        const fqn = row.latest_version?.fqn;
        const name = row.name;
        if (fqn == null || fqn === "" || name == null || name === "") continue;
        const description = row.latest_version?.manifest?.source?.description;
        out.push({
            id: fqn,
            name,
            fqn,
            ...(description != null ? { description } : {}),
        });
    }
    return out;
}

export async function listAgentSkills(
    opts: CpCredentials,
): Promise<TfySkillSelectorEntry[]> {
    const raw = await cpFetch<unknown>(
        opts,
        "/api/ml/v1/agent-skills?include_empty_agent_skills=false",
    );
    return normalizeAgentSkills(raw);
}

// ---------------------------------------------------------------------------
// MCP
// ---------------------------------------------------------------------------

type RawMcpServer = {
    id?: string;
    name?: string;
    fqn?: string;
    manifest?: {
        description?: string;
        url?: string;
        auth_data?: { type?: string; auth_level?: string };
    };
    authStatus?: { status?: string };
};

export function normalizeMcpServers(raw: unknown): TfyConnectorSelectorEntry[] {
    const data =
        raw != null &&
        typeof raw === "object" &&
        Array.isArray((raw as { data?: unknown }).data)
            ? ((raw as { data: RawMcpServer[] }).data)
            : [];
    const out: TfyConnectorSelectorEntry[] = [];
    const seen = new Set<string>();
    for (const row of data) {
        const mcpName = row.name;
        if (mcpName == null || mcpName === "" || seen.has(mcpName)) continue;
        seen.add(mcpName);
        const description = row.manifest?.description;
        const authenticated = row.authStatus?.status === "authenticated";
        out.push({
            id: mcpName,
            name: mcpName,
            mcpName,
            ...(description != null ? { description } : {}),
            ...(row.id != null ? { serverId: row.id } : { serverId: null }),
            authenticated,
        });
    }
    return out;
}

export async function listMcpServers(
    opts: CpCredentials,
): Promise<TfyConnectorSelectorEntry[]> {
    const raw = await cpFetch<unknown>(opts, "/api/svc/v1/mcp-servers");
    return normalizeMcpServers(raw);
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

type RawAgent = {
    id?: string;
    name?: string;
    latestVersionDetails?: {
        manifest?: unknown;
    };
    /** Defensive: some payloads nest manifest at the top level. */
    manifest?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

function snakeToCamelKey(key: string): string {
    return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Deep snake_case → camelCase (inverse of {@link toSnakeCaseDeep}). */
export function toCamelCaseDeep(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(toCamelCaseDeep);
    }
    if (isRecord(value)) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            out[snakeToCamelKey(k)] = toCamelCaseDeep(v);
        }
        return out;
    }
    return value;
}

/**
 * Map a CP AgentManifest (snake_case wire) → FE AgentSpec for Edit seeding.
 * Skills/MCP keep `{ id, name }` for draft pickers plus runtime fields
 * (`enableTools`, `preload`, `config`) so Edit → Save does not widen tool
 * access or wipe settings. Gateway registry shapes are restored on save via
 * normalizeAgentSpecForGateway.
 */
export function agentSpecFromCpManifest(manifest: unknown): TfyAgentSpec | undefined {
    if (!isRecord(manifest)) return undefined;
    const modelRaw = manifest.model;
    if (!isRecord(modelRaw) || typeof modelRaw.name !== "string" || modelRaw.name === "") {
        return undefined;
    }
    const model = toCamelCaseDeep(modelRaw) as TfyAgentSpec["model"];

    // Catalog-shaped mounts (`id`/`name` + runtime fields). Not yet gateway
    // registry unions — normalizeAgentSpecForGateway restores those on save.
    const skills: Array<Record<string, unknown>> = [];
    if (Array.isArray(manifest.skills)) {
        for (const row of manifest.skills) {
            if (!isRecord(row)) continue;
            const fqn =
                typeof row.fqn === "string" && row.fqn !== ""
                    ? row.fqn
                    : typeof row.id === "string" && row.id !== ""
                      ? row.id
                      : null;
            if (fqn == null) continue;
            const camel = toCamelCaseDeep(row) as Record<string, unknown>;
            const name =
                typeof camel.name === "string" && camel.name !== ""
                    ? camel.name
                    : fqn;
            skills.push({
                id: fqn,
                name,
                ...(typeof camel.preload === "boolean"
                    ? { preload: camel.preload }
                    : {}),
                ...(camel.config != null ? { config: camel.config } : {}),
            });
        }
    }

    const mcpServers: Array<Record<string, unknown>> = [];
    const mcpRaw = Array.isArray(manifest.mcp_servers)
        ? manifest.mcp_servers
        : Array.isArray(manifest.mcpServers)
          ? manifest.mcpServers
          : [];
    for (const row of mcpRaw) {
        if (!isRecord(row)) continue;
        const camel = toCamelCaseDeep(row) as Record<string, unknown>;
        const name =
            typeof camel.name === "string" && camel.name !== ""
                ? camel.name
                : typeof camel.id === "string" && camel.id !== ""
                  ? camel.id
                  : null;
        if (name == null) continue;
        mcpServers.push({
            id: name,
            name,
            ...(Array.isArray(camel.enableTools)
                ? { enableTools: camel.enableTools }
                : {}),
            ...(typeof camel.preload === "boolean"
                ? { preload: camel.preload }
                : {}),
            ...(camel.config != null ? { config: camel.config } : {}),
        });
    }

    const configRaw = manifest.config;
    const config =
        configRaw != null ? (toCamelCaseDeep(configRaw) as TfyAgentSpec["config"]) : undefined;

    return {
        model,
        ...(typeof manifest.instructions === "string"
            ? { instructions: manifest.instructions }
            : {}),
        ...(config != null ? { config } : {}),
        ...(skills.length > 0 ? { skills } : {}),
        ...(mcpServers.length > 0 ? { mcpServers } : {}),
    } as TfyAgentSpec;
}

export function normalizeAgents(raw: unknown): TfyAgentSelectorEntry[] {
    const data =
        raw != null &&
        typeof raw === "object" &&
        Array.isArray((raw as { data?: unknown }).data)
            ? ((raw as { data: RawAgent[] }).data)
            : [];
    const out: TfyAgentSelectorEntry[] = [];
    for (const row of data) {
        if (row.name == null || row.name === "") continue;
        const manifest = row.latestVersionDetails?.manifest ?? row.manifest;
        const agentSpec = agentSpecFromCpManifest(manifest);
        const agentId =
            typeof row.id === "string" && row.id !== "" ? row.id : row.name;
        out.push({
            name: row.name,
            agentId,
            ...(agentSpec != null ? { agentSpec } : {}),
        });
    }
    return out;
}

export async function listAgents(
    opts: CpCredentials,
    req?: SearchAgentSelectorParams,
): Promise<TfyAgentSelectorEntry[]> {
    const limit = req?.limit ?? 50;
    const offset = req?.offset ?? 0;
    const namePrefix = req?.query ?? "";
    const qs = new URLSearchParams({
        type: "truefoundry-agent",
        limit: String(limit),
        offset: String(offset),
        namePrefix,
    });
    const raw = await cpFetch<unknown>(
        opts,
        `/api/svc/v1/agents?${qs.toString()}`,
    );
    return normalizeAgents(raw);
}

// ---------------------------------------------------------------------------
// Save agent (PUT upsert by name)
// ---------------------------------------------------------------------------

/** Platform feature flags baked into every saved agent manifest. */
export const SAVE_AGENT_METADATA_TAGS = {
    agent: "tfy-ai-gateway-agent",
    TFY_ALPHA_ENABLE_OPENUI: "true",
    TFY_ALPHA_ENABLE_ASK_USER: "true",
    TFY_ALPHA_ENABLE_ASK_SECRET: "true",
    TFY_ALPHA_CONTEXT_MANAGEMENT:
        '{"large_tool_response":{"individual_tool_response_token_threshold":8000}}',
    TFY_ALPHA_ENABLE_FILE_DOWNLOAD: "true",
} as const;

/** Default ACL on create/update — everyone on the tenant gets agent-access. */
export const SAVE_AGENT_COLLABORATORS = [
    { subject: "team:everyone", role_id: "agent-access" },
] as const;

function camelToSnakeKey(key: string): string {
    return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Deep camelCase → snake_case for CP wire (model.params, config, mounts). */
export function toSnakeCaseDeep(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(toSnakeCaseDeep);
    }
    if (value != null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[camelToSnakeKey(k)] = toSnakeCaseDeep(v);
        }
        return out;
    }
    return value;
}

function mcpMountForCp(mount: unknown): Record<string, unknown> {
    const snake = toSnakeCaseDeep(mount) as Record<string, unknown>;
    if (snake.type === "truefoundry-mcp-registry") {
        return {
            ...snake,
            enable_tools: snake.enable_tools ?? ["@all"],
            preload: snake.preload ?? false,
        };
    }
    return snake;
}

function skillMountForCp(mount: unknown): Record<string, unknown> {
    const snake = toSnakeCaseDeep(mount) as Record<string, unknown>;
    if (snake.type === "truefoundry-skills-registry") {
        return {
            ...snake,
            preload: snake.preload ?? false,
        };
    }
    return snake;
}

/**
 * Build CP `manifest` for `PUT /api/svc/v1/agents`.
 * Normalizes UI catalog mounts, snake_cases gateway fields, hardcodes type /
 * metadata_tags / collaborators.
 */
export function buildSaveAgentManifest(
    agentName: string,
    agentSpec: TfyAgentSpec,
): Record<string, unknown> {
    const spec = normalizeAgentSpecForGateway(agentSpec);
    const mcpServers = (spec.mcpServers ?? []).map(mcpMountForCp);
    const skills = (spec.skills ?? []).map(skillMountForCp);
    // CP AgentManifest requires description; not on FE AgentSpec yet.
    const rawDescription = (agentSpec as { description?: unknown }).description;
    const description = typeof rawDescription === "string" ? rawDescription : "";

    return {
        type: "truefoundry-agent",
        name: agentName,
        description,
        model: toSnakeCaseDeep(spec.model),
        metadata_tags: { ...SAVE_AGENT_METADATA_TAGS },
        collaborators: [...SAVE_AGENT_COLLABORATORS],
        ...(spec.instructions != null ? { instructions: spec.instructions } : {}),
        ...(spec.config != null ? { config: toSnakeCaseDeep(spec.config) } : {}),
        ...(mcpServers.length > 0 ? { mcp_servers: mcpServers } : {}),
        ...(skills.length > 0 ? { skills } : {}),
    };
}

/**
 * Upsert a named agent on the Control Plane.
 * `PUT /api/svc/v1/agents` with `{ manifest }` — name is the upsert key.
 */
export async function saveAgent(
    opts: CpCredentials,
    req: SaveAgentRequest<TfyAgentSpec>,
): Promise<unknown> {
    const manifest = buildSaveAgentManifest(req.agentName, req.agentSpec);
    return cpFetch(opts, "/api/svc/v1/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest }),
    });
}
