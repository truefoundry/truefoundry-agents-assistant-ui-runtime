import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

export type { AgentSpec };

export const DEFAULT_DRAFT_AGENT_SPEC: AgentSpec = {
    model: {
        name: "anthropic/claude-sonnet-4-6",
        params: {
            maxTokens: 4096,
            temperature: 1.0,
            reasoningEffort: "low",
        },
    },
    instructions:
        "You are a helpful support assistant that helps customers file issues.",
    skills: [],
    mcpServers: [],
};

export const EXAMPLE_MCP_SERVER_NAMES = ["zendesk", "github", "slack"] as const;

export const EXAMPLE_SKILL_FQNS = [
    "agent-skill:truefoundry/skills/web-search:1",
    "agent-skill:truefoundry/skills/code-interpreter:2",
] as const;

export const EXAMPLE_MODEL_NAMES = [
    "anthropic/claude-sonnet-4-6",
    "openai-main/gpt-4o",
    "openai-main/gpt-4o-mini",
] as const;

export function connectorStatusLabel(spec: AgentSpec | null): string | undefined {
    if (spec == null) {
        return undefined;
    }
    const mcpCount = spec.mcpServers?.length ?? 0;
    const skillCount = spec.skills?.length ?? 0;
    return `${mcpCount} MCP · ${skillCount} skills`;
}
