/**
 * CP provider-account metadata → ModelSelectorEntry.properties.reasoningEfforts.
 *
 * Source: GET /api/svc/v1/provider-accounts/providers
 * Join key: `${providerSlug}/${modelId}` (NOT model_fqn).
 * Host (ai.tf) uses the same rules for the draft reasoning-effort picker.
 */

export type ModelParamDef = {
    key: string;
    type?: string;
    defaultValue?: string | number | boolean | null;
    maxValue?: number;
    minValue?: number;
    /** Legacy — prefer `supportedValues` from the real API. */
    options?: string[];
    supportedValues?: string[];
};

export type ModelMetadata = {
    thinking?: boolean;
    removeParams?: string[];
    params?: ModelParamDef[];
    features?: string[];
    limits?: {
        context_window?: number;
        max_output_tokens?: number;
        max_tokens?: number;
    };
    input_cost_per_million_tokens?: number;
    output_cost_per_million_tokens?: number;
    cost?: {
        input?: number;
        output?: number;
        input_per_million_tokens?: number;
        output_per_million_tokens?: number;
        input_cost_per_million_tokens?: number;
        output_cost_per_million_tokens?: number;
    };
    pricing?: {
        input?: number;
        output?: number;
        input_per_million_tokens?: number;
        output_per_million_tokens?: number;
        input_cost_per_million_tokens?: number;
        output_cost_per_million_tokens?: number;
    };
    /** Provider-wide defaults; reasoning_effort often lives only here. */
    defaultProviderParams?: {
        params?: ModelParamDef[];
    };
};

const DEFAULT_EFFORT_LEVELS: readonly string[] = [
    "minimal",
    "low",
    "medium",
    "high",
] as const;

const EFFORT_SET = new Set([
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
]);

/** Canonical metadata key: `<providerSlug>/<modelId>` (NOT model_fqn). */
export function metadataKey(providerSlug: string, modelId: string): string {
    return `${providerSlug}/${modelId}`;
}

function providerSlugFromType(type: string | undefined): string | null {
    if (type == null) return null;
    const prefix = "provider-account/";
    if (!type.startsWith(prefix)) return null;
    const slug = type.slice(prefix.length).trim();
    return slug.length > 0 ? slug : null;
}

function findReasoningEffortParam(
    meta: ModelMetadata | undefined,
): ModelParamDef | undefined {
    const fromModel = meta?.params?.find((p) => p.key === "reasoning_effort");
    if (fromModel != null) return fromModel;
    return meta?.defaultProviderParams?.params?.find(
        (p) => p.key === "reasoning_effort",
    );
}

/**
 * Show efforts when thinking is on, reasoning_effort is not removed, and the
 * provider slug is not exact `"openai"` (azure-openai / openai-main still show).
 */
export function showsReasoningEffort(
    meta: ModelMetadata | undefined,
    providerSlug: string,
): boolean {
    if (providerSlug === "openai") return false;
    if (meta == null) return false;
    if (meta.thinking !== true) return false;
    if (meta.removeParams?.includes("reasoning_effort")) return false;
    return true;
}

export function getEffortOptions(meta: ModelMetadata | undefined): string[] {
    const param = findReasoningEffortParam(meta);
    const raw = param?.supportedValues ?? param?.options;
    if (raw == null || raw.length === 0) return [...DEFAULT_EFFORT_LEVELS];
    const filtered = raw.filter((v) => EFFORT_SET.has(v));
    return filtered.length > 0 ? filtered : [...DEFAULT_EFFORT_LEVELS];
}

/** Options for the selector, or undefined when the picker should stay hidden. */
export function reasoningEffortsForModel(
    meta: ModelMetadata | undefined,
    providerSlug: string,
): string[] | undefined {
    if (!showsReasoningEffort(meta, providerSlug)) return undefined;
    return getEffortOptions(meta);
}

type RawIntegration = {
    type?: string;
    metadata?: Record<string, ModelMetadata>;
};

type RawProvider = {
    type?: string;
    integrations?: RawIntegration[];
};

function providersFromJson(json: unknown): RawProvider[] {
    if (Array.isArray(json)) return json as RawProvider[];
    if (json != null && typeof json === "object") {
        const obj = json as Record<string, unknown>;
        for (const key of ["data", "providers", "result"] as const) {
            const value = obj[key];
            if (Array.isArray(value)) return value as RawProvider[];
        }
    }
    return [];
}

/** Build a map keyed by `<providerSlug>/<modelId>` from the providers API. */
export function buildMetadataMap(raw: unknown): Map<string, ModelMetadata> {
    const map = new Map<string, ModelMetadata>();
    for (const provider of providersFromJson(raw)) {
        const slug = providerSlugFromType(provider.type);
        if (slug == null) continue;
        for (const integration of provider.integrations ?? []) {
            const metadata = integration.metadata;
            if (metadata == null) continue;
            for (const [modelId, meta] of Object.entries(metadata)) {
                if (!modelId.trim()) continue;
                map.set(metadataKey(slug, modelId), meta);
            }
        }
    }
    return map;
}
