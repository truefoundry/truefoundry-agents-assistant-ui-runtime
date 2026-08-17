import type { TruefoundryGatewayApi } from "truefoundry-gateway-sdk";

import type { TfyAgentSpec } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
    return typeof value === "string" && value !== "" ? value : null;
}

/** Optional BaseMcpServer fields shared by registry + inline mounts. */
function mcpOptionalFields(raw: Record<string, unknown>): Record<string, unknown> {
    return {
        ...(Array.isArray(raw.enableTools) ? { enableTools: raw.enableTools } : {}),
        ...(Array.isArray(raw.disableTools) ? { disableTools: raw.disableTools } : {}),
        ...(Array.isArray(raw.preloadTools) ? { preloadTools: raw.preloadTools } : {}),
        ...(Array.isArray(raw.requireApprovalForTools)
            ? { requireApprovalForTools: raw.requireApprovalForTools }
            : {}),
        ...(typeof raw.preload === "boolean" ? { preload: raw.preload } : {}),
        ...(raw.config != null ? { config: raw.config } : {}),
    };
}

function skillOptionalFields(raw: Record<string, unknown>): Record<string, unknown> {
    return {
        ...(typeof raw.preload === "boolean" ? { preload: raw.preload } : {}),
        ...(raw.config != null ? { config: raw.config } : {}),
    };
}

/**
 * agent-ui-sdk DraftCompositeSelector writes catalog rows as `{ id, name }`.
 * Gateway AgentSpec mounts need discriminated registry shapes — without
 * `type` (and skill `fqn`), Fern serialization throws JsonError before PATCH.
 *
 * Our CP catalog sets skill `id` = version fqn and MCP `id` = server name.
 * Always rebuild allowlisted fields so FE `id` / display `name` / registry
 * `url` never leak onto the wire.
 */
export function normalizeMcpMount(
    raw: unknown,
): TruefoundryGatewayApi.McpServer {
    if (!isRecord(raw)) {
        throw new Error("mcpServers entry must be an object");
    }

    if (raw.type === "inline") {
        const name = nonEmptyString(raw.name);
        const url = nonEmptyString(raw.url);
        if (name == null || url == null) {
            throw new Error("inline mcpServers entry needs name and url");
        }
        return {
            type: "inline",
            name,
            url,
            ...mcpOptionalFields(raw),
        } as unknown as TruefoundryGatewayApi.McpServer;
    }

    const name =
        nonEmptyString(raw.name) ??
        nonEmptyString(raw.mcpName) ??
        nonEmptyString(raw.id);
    if (name == null) {
        throw new Error(
            "mcpServers entry needs name, mcpName, or id to mount as registry MCP",
        );
    }

    return {
        type: "truefoundry-mcp-registry",
        name,
        ...mcpOptionalFields(raw),
        // Always set after the spread so missing enableTools defaults to [@all].
        enableTools: Array.isArray(raw.enableTools) ? raw.enableTools : ["@all"],
    } as unknown as TruefoundryGatewayApi.McpServer;
}

export function normalizeSkillMount(
    raw: unknown,
): TruefoundryGatewayApi.SkillMount {
    if (!isRecord(raw)) {
        throw new Error("skills entry must be an object");
    }

    if (raw.type === "git") {
        const url = nonEmptyString(raw.url);
        const name = nonEmptyString(raw.name);
        const ref = nonEmptyString(raw.ref);
        if (url == null || name == null || ref == null) {
            throw new Error("git skills entry needs url, name, and ref");
        }
        return {
            type: "git",
            url,
            name,
            ref,
            ...(nonEmptyString(raw.path) != null ? { path: raw.path } : {}),
            ...skillOptionalFields(raw),
        } as unknown as TruefoundryGatewayApi.SkillMount;
    }

    const fqn = nonEmptyString(raw.fqn) ?? nonEmptyString(raw.id);
    if (fqn == null) {
        throw new Error(
            "skills entry needs fqn or id to mount as registry skill",
        );
    }
    return {
        type: "truefoundry-skills-registry",
        fqn,
        ...skillOptionalFields(raw),
    } as unknown as TruefoundryGatewayApi.SkillMount;
}

/** Rewrite UI `{id,name}` mounts so create/update draft session can serialize. */
export function normalizeAgentSpecForGateway<TSpec extends TfyAgentSpec>(
    spec: TSpec,
): TSpec {
    return {
        ...spec,
        ...(spec.mcpServers != null
            ? {
                  mcpServers: spec.mcpServers.map(
                      normalizeMcpMount,
                  ) as TSpec["mcpServers"],
              }
            : {}),
        ...(spec.skills != null
            ? {
                  skills: spec.skills.map(
                      normalizeSkillMount,
                  ) as TSpec["skills"],
              }
            : {}),
    };
}
