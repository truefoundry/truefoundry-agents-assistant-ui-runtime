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
import {
    buildMetadataMap,
    metadataKey,
    reasoningEffortsForModel,
} from "./modelReasoningEffort.js";
import { normalizeAgentSpecForGateway } from "./normalizeAgentSpec.js";
import type { TfyAgentSpec, TfySaveAgentResult } from "./types.js";

// ---------------------------------------------------------------------------
// Selector rows — FE base + TFY mount fields
// ---------------------------------------------------------------------------

export interface TfyModelSelectorEntry extends ModelSelectorEntry {
    /**
     * model_fqn for AgentSpec.model.name.
     * Same value as {@link ModelSelectorEntry.name} / `id` — trueforge-ui writes
     * `name` into the spec; keep this alias for hosts that still read `apiModel`.
     */
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
    // Gateway AgentSpec.model.name must be model_fqn (e.g. account/model-id).
    // trueforge-ui DraftModelSelector writes ModelSelectorEntry.name into that
    // field, so `name` is the FQN — not the CP short display label.
    const apiModel = row.model_fqn ?? row.id;
    if (apiModel == null || apiModel === "") {
        return null;
    }
    const modelId = row.model_id ?? row.name ?? apiModel;
    return {
        id: apiModel,
        name: apiModel,
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

/**
 * Attach `properties.reasoningEfforts` from provider-account metadata when the
 * model supports thinking. Pure — used by {@link listEnabledModels} and tests.
 */
export function enrichModelsWithReasoningEfforts(
    models: TfyModelSelectorEntry[],
    providerMetadataRaw: unknown,
): TfyModelSelectorEntry[] {
    const map = buildMetadataMap(providerMetadataRaw);
    if (map.size === 0) return models;
    return models.map((model) => {
        const meta = map.get(metadataKey(model.provider.name, model.modelId));
        const reasoningEfforts = reasoningEffortsForModel(
            meta,
            model.provider.name,
        );
        if (reasoningEfforts == null) return model;
        return {
            ...model,
            properties: { ...model.properties, reasoningEfforts },
        };
    });
}

export async function listEnabledModels(
    opts: CpCredentials,
): Promise<TfyModelSelectorEntry[]> {
    // Parallel: providers is enrichment-only; soft-fail keeps models usable.
    const [raw, providers] = await Promise.all([
        cpFetch<unknown>(opts, "/api/svc/v1/llm-gateway/model/enabled"),
        cpFetch<unknown>(
            opts,
            "/api/svc/v1/provider-accounts/providers",
        ).catch(() => null),
    ]);
    const models = normalizeEnabledModels(raw);
    if (providers == null) return models;
    return enrichModelsWithReasoningEfforts(models, providers);
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

/** Keys are user data (e.g. metadata tag names) — copied verbatim, never case-converted. */
function stringRecordFromCp(raw: unknown): Record<string, string> | undefined {
    if (!isRecord(raw)) return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "string") out[key] = value;
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Variable names are user keys and must survive verbatim. Values appear as
 * plain strings in new manifests and `{ default_value }` records in older
 * ones; both collapse to the resolved string.
 */
function variablesFromCp(raw: unknown): Record<string, string> | undefined {
    if (!isRecord(raw)) return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "string") {
            out[key] = value;
        } else if (isRecord(value) && typeof value.default_value === "string") {
            out[key] = value.default_value;
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Rebuild the gateway ResponseFormat from the wire shape. Only the envelope
 * key changes case (`json_schema` → `jsonSchema`); the `schema` body is a
 * user-authored JSON schema whose property names must not be rewritten.
 */
function responseFormatFromCp(raw: unknown): TfyAgentSpec["responseFormat"] {
    if (!isRecord(raw)) return undefined;
    if (raw.type === "text") return { type: "text" };
    if (raw.type === "json_object") return { type: "json_object" };
    if (raw.type !== "json_schema") return undefined;
    const wireSchema = isRecord(raw.json_schema) ? raw.json_schema : undefined;
    if (wireSchema == null || typeof wireSchema.name !== "string") return undefined;
    return {
        type: "json_schema",
        jsonSchema: {
            name: wireSchema.name,
            ...(typeof wireSchema.description === "string"
                ? { description: wireSchema.description }
                : {}),
            ...(isRecord(wireSchema.schema) ? { schema: wireSchema.schema } : {}),
            ...(typeof wireSchema.strict === "boolean" || wireSchema.strict === null
                ? { strict: wireSchema.strict }
                : {}),
        },
    };
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

    // Wire-named pass-through fields (description, messages, collaborators)
    // need no mount remapping — one camelCase pass and a shape guard each.
    // Guards drop malformed values instead of seeding the editor with garbage.
    const camel = toCamelCaseDeep(manifest) as Record<string, unknown>;
    const description =
        typeof camel.description === "string" ? camel.description : undefined;
    const messages = Array.isArray(camel.messages)
        ? (camel.messages as TfyAgentSpec["messages"])
        : undefined;
    const collaborators = Array.isArray(camel.collaborators)
        ? (camel.collaborators as TfyAgentSpec["collaborators"])
        : undefined;

    // User-keyed fields are read from the RAW manifest: their keys are data
    // (tag names like "TFY_ALPHA_ENABLE_OPENUI", variable names like
    // "my_city", JSON-schema property names), and case-converting them
    // corrupts saved agents (e.g. "TFY_ALPHA…" → "tfyAlpha…" → on the next
    // save "_t_f_y__a_l_p_h_a__…").
    const variables = variablesFromCp(manifest.variables);
    const metadataTags = stringRecordFromCp(manifest.metadata_tags);
    const responseFormat = responseFormatFromCp(manifest.response_format);

    return {
        model,
        ...(typeof manifest.instructions === "string"
            ? { instructions: manifest.instructions }
            : {}),
        ...(description != null ? { description } : {}),
        ...(variables != null ? { variables } : {}),
        ...(messages != null ? { messages } : {}),
        ...(responseFormat != null ? { responseFormat } : {}),
        ...(metadataTags != null ? { metadataTags } : {}),
        ...(collaborators != null ? { collaborators } : {}),
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
 * Snake-case only the response_format envelope (`jsonSchema` → `json_schema`);
 * the `schema` body is a user-authored JSON schema whose property names must
 * not be rewritten. Inverse of {@link responseFormatFromCp}.
 */
function responseFormatForCp(
    responseFormat: NonNullable<TfyAgentSpec["responseFormat"]>,
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(responseFormat)) {
        if (key === "jsonSchema" && isRecord(value)) {
            const inner: Record<string, unknown> = {};
            for (const [innerKey, innerValue] of Object.entries(value)) {
                inner[camelToSnakeKey(innerKey)] =
                    innerKey === "schema" ? innerValue : toSnakeCaseDeep(innerValue);
            }
            out.json_schema = inner;
            continue;
        }
        out[camelToSnakeKey(key)] = toSnakeCaseDeep(value);
    }
    return out;
}

/**
 * Build CP `manifest` for `PUT /api/svc/v1/agents`.
 *
 * Wire-named spec fields are snake-cased and spread so any field the host
 * puts on the spec reaches the wire without this adapter enumerating it.
 * metadataTags / variables / responseFormat are pulled out FIRST because
 * their keys are user data — snake-casing a tag named
 * "TFY_ALPHA_ENABLE_OPENUI" would corrupt it to "_t_f_y__a_l_p_h_a__…" —
 * and re-attached verbatim after the spread.
 *
 * Field order matters:
 *  1. `...snake` — everything wire-named the host provided.
 *  2. description / metadata_tags / collaborators — CP requires these, so
 *     platform defaults fill in only when the host omitted them.
 *  3. mcp_servers / skills — overwrite the spread values because catalog
 *     mounts need remapping to gateway registry shapes (mcpMountForCp /
 *     skillMountForCp), which plain snake-casing cannot do.
 */
export function buildSaveAgentManifest(
    agentName: string,
    agentSpec: TfyAgentSpec,
): Record<string, unknown> {
    const spec = normalizeAgentSpecForGateway(agentSpec);
    const mcpServers = (spec.mcpServers ?? []).map(mcpMountForCp);
    const skills = (spec.skills ?? []).map(skillMountForCp);
    const { metadataTags, variables, responseFormat, ...wireFields } = spec;
    const snake = toSnakeCaseDeep(wireFields) as Record<string, unknown>;

    return {
        type: "truefoundry-agent",
        name: agentName,
        ...snake,
        description: typeof snake.description === "string" ? snake.description : "",
        metadata_tags: metadataTags ?? { ...SAVE_AGENT_METADATA_TAGS },
        collaborators: Array.isArray(snake.collaborators)
            ? snake.collaborators
            : [...SAVE_AGENT_COLLABORATORS],
        ...(variables != null ? { variables } : {}),
        ...(responseFormat != null
            ? { response_format: responseFormatForCp(responseFormat) }
            : {}),
        ...(mcpServers.length > 0 ? { mcp_servers: mcpServers } : {}),
        ...(skills.length > 0 ? { skills } : {}),
    };
}

function nonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Normalize CP save responses into
 * `{ agentId, versionId }`. Observed live shapes (both camelCase, wrapped):
 *   { data: { id: "<versionId>", agentId: "<agentId>", fqn, version, … } } //agent-playground
 *   { data: { id: "<agentId>", name, manifest } }  — no separate version //trueforge
 * `id` is a version id only when a distinct `agentId` accompanies it;
 * otherwise `id` is the agent itself and no version id is known.
 */
export function saveAgentResultFromCp(raw: unknown): TfySaveAgentResult {
    const root = isRecord(raw) ? raw : {};
    const data = isRecord(root.data) ? root.data : {};
    const agentId = nonEmptyString(data.agentId) ?? nonEmptyString(data.id);
    const versionId =
        nonEmptyString(data.agentId) != null ? nonEmptyString(data.id) : undefined;
    return {
        ...(agentId != null ? { agentId } : {}),
        ...(versionId != null ? { versionId } : {}),
    };
}

/**
 * Upsert a named agent on the Control Plane.
 * `PUT /api/svc/v1/agents` with `{ manifest }` — name is the upsert key.
 */
export async function saveAgent(
    opts: CpCredentials,
    req: SaveAgentRequest<TfyAgentSpec>,
): Promise<TfySaveAgentResult> {
    const manifest = buildSaveAgentManifest(req.agentName, req.agentSpec);
    const raw = await cpFetch<unknown>(opts, "/api/svc/v1/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest }),
    });
    return saveAgentResultFromCp(raw);
}
