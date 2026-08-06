import type { TruefoundryGatewayApi } from "truefoundry-gateway-sdk";

import type { TfyAgentSpec } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * agent-ui-sdk DraftCompositeSelector writes catalog rows as `{ id, name }`.
 * Gateway AgentSpec mounts need discriminated registry shapes — without
 * `type` (and skill `fqn`), Fern serialization throws JsonError before PATCH.
 *
 * Our CP catalog sets skill `id` = version fqn and MCP `id` = server name.
 */
export function normalizeMcpMount(
    raw: unknown,
): TruefoundryGatewayApi.McpServer {
    if (!isRecord(raw)) {
        throw new Error("mcpServers entry must be an object");
    }
    if (raw.type === "truefoundry-mcp-registry" || raw.type === "inline") {
        return raw as unknown as TruefoundryGatewayApi.McpServer;
    }
    const name =
        (typeof raw.name === "string" && raw.name !== "" ? raw.name : null) ??
        (typeof raw.mcpName === "string" && raw.mcpName !== ""
            ? raw.mcpName
            : null) ??
        (typeof raw.id === "string" && raw.id !== "" ? raw.id : null);
    if (name == null) {
        throw new Error(
            "mcpServers entry needs name, mcpName, or id to mount as registry MCP",
        );
    }
    return {
        type: "truefoundry-mcp-registry",
        name,
        ...(Array.isArray(raw.enableTools) ? { enableTools: raw.enableTools } : {}),
        ...(typeof raw.preload === "boolean" ? { preload: raw.preload } : {}),
        ...(raw.config != null ? { config: raw.config } : {}),
    } as unknown as TruefoundryGatewayApi.McpServer;
}

export function normalizeSkillMount(
    raw: unknown,
): TruefoundryGatewayApi.SkillMount {
    if (!isRecord(raw)) {
        throw new Error("skills entry must be an object");
    }
    if (raw.type === "truefoundry-skills-registry" || raw.type === "git") {
        return raw as unknown as TruefoundryGatewayApi.SkillMount;
    }
    const fqn =
        (typeof raw.fqn === "string" && raw.fqn !== "" ? raw.fqn : null) ??
        (typeof raw.id === "string" && raw.id !== "" ? raw.id : null);
    if (fqn == null) {
        throw new Error(
            "skills entry needs fqn or id to mount as registry skill",
        );
    }
    return {
        type: "truefoundry-skills-registry",
        fqn,
        ...(typeof raw.preload === "boolean" ? { preload: raw.preload } : {}),
        ...(raw.config != null ? { config: raw.config } : {}),
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
