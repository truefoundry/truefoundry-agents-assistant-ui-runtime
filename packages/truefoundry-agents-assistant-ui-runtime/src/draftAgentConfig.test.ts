import { describe, expect, it } from "vitest";

import { mergeAgentSpec, type AgentSpec } from "./private/agentSpec.js";
import {
    resolveTrueFoundryAgentConfig,
    resolveTrueFoundryAgentRuntimeOptions,
} from "./types.js";
import type { AgentSessionClient } from "truefoundry-gateway-sdk/agents";
import type { PrivateAgentSessionClient } from "truefoundry-gateway-sdk/agents/private";

describe("resolveTrueFoundryAgentConfig", () => {
    it("supports legacy agentName", () => {
        expect(resolveTrueFoundryAgentConfig({ agentName: "my-agent" })).toEqual({
            mode: "named",
            agentName: "my-agent",
        });
    });

    it("prefers explicit agentName over named config", () => {
        expect(
            resolveTrueFoundryAgentConfig({
                agent: { mode: "named", agentName: "ignored" },
                agentName: "preferred",
            }),
        ).toEqual({
            mode: "named",
            agentName: "preferred",
        });
    });

    it("returns draft config unchanged", () => {
        const spec = { model: { name: "openai/gpt-4o" } };
        expect(
            resolveTrueFoundryAgentConfig({
                agent: { mode: "draft", defaultAgentSpec: spec },
            }),
        ).toEqual({
            mode: "draft",
            defaultAgentSpec: spec,
        });
    });
});

describe("resolveTrueFoundryAgentRuntimeOptions", () => {
    const client = {} as AgentSessionClient;

    it("requires privateClient for draft mode", () => {
        expect(() =>
            resolveTrueFoundryAgentRuntimeOptions({
                client,
                agent: { mode: "draft", defaultAgentSpec: { model: { name: "x" } } },
            }),
        ).toThrow(/privateClient/);
    });

    it("accepts privateClient for draft mode", () => {
        const privateClient = {} as PrivateAgentSessionClient;
        const resolved = resolveTrueFoundryAgentRuntimeOptions({
            client,
            privateClient,
            agent: { mode: "draft", defaultAgentSpec: { model: { name: "x" } } },
        });
        expect(resolved.privateClient).toBe(privateClient);
        expect(resolved.agent.mode).toBe("draft");
    });
});

describe("mergeAgentSpec", () => {
    it("deep-merges model params", () => {
        const base = {
            model: {
                name: "anthropic/claude-sonnet-4-6",
                params: { maxTokens: 1024, temperature: 0.5 },
            },
        };
        const next = mergeAgentSpec(base, {
            model: { params: { temperature: 1.0 } },
        });
        expect(next.model.params).toEqual({ maxTokens: 1024, temperature: 1.0 });
    });

    it("replaces mcpServers array wholesale", () => {
        const base: AgentSpec = {
            model: { name: "openai/gpt-4o" },
            mcpServers: [{ type: "truefoundry-mcp-registry", name: "github", enableTools: ["@all"] }],
        };
        const next = mergeAgentSpec(base, {
            mcpServers: [{ type: "truefoundry-mcp-registry", name: "slack", enableTools: ["@all"] }],
        });
        expect(next.mcpServers).toEqual([{ type: "truefoundry-mcp-registry", name: "slack", enableTools: ["@all"] }]);
    });

    it("replaces skills array wholesale", () => {
        const base = {
            model: { name: "openai/gpt-4o" },
            skills: [{ fqn: "acme/skill-a:1", preload: false }],
        };
        const next = mergeAgentSpec(base, {
            skills: [{ fqn: "acme/skill-b:2", preload: true }],
        });
        expect(next.skills).toEqual([{ fqn: "acme/skill-b:2", preload: true }]);
    });

    it("model partial update does not clear mcpServers or skills", () => {
        const base: AgentSpec = {
            model: { name: "openai/gpt-4o", params: { maxTokens: 1024 } },
            mcpServers: [{ type: "truefoundry-mcp-registry", name: "github", enableTools: ["@all"] }],
            skills: [{ fqn: "acme/skill-a:1", preload: false }],
        };
        const next = mergeAgentSpec(base, {
            model: { name: "anthropic/claude-sonnet-4-6" },
        });
        expect(next.model.name).toBe("anthropic/claude-sonnet-4-6");
        expect(next.mcpServers).toEqual(base.mcpServers);
        expect(next.skills).toEqual(base.skills);
    });
});
