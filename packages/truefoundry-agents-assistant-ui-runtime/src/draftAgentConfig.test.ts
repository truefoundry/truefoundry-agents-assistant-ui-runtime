import { describe, expect, it } from "vitest";

import { mergeAgentSpec } from "./draft/agentSpec.js";
import type { AgentSpec } from "./server/types.js";
import {
    resolveAgentConfig,
    resolveAgentRuntimeOptions,
} from "./types.js";
import type { AgentChatServer } from "./server/index.js";

describe("resolveAgentConfig", () => {
    it("supports legacy agentName", () => {
        expect(resolveAgentConfig({ agentName: "my-agent" })).toEqual({
            mode: "named",
            agentName: "my-agent",
        });
    });

    it("prefers explicit agentName over named config", () => {
        expect(
            resolveAgentConfig({
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
            resolveAgentConfig({
                agent: { mode: "draft", defaultAgentSpec: spec },
            }),
        ).toEqual({
            mode: "draft",
            defaultAgentSpec: spec,
        });
    });
});

describe("resolveAgentRuntimeOptions", () => {
    const server = {} as AgentChatServer;

    it("accepts draft mode without a private client", () => {
        const resolved = resolveAgentRuntimeOptions({
            server,
            agent: { mode: "draft", defaultAgentSpec: { model: { name: "x" } } },
        });
        expect(resolved.server).toBe(server);
        expect(resolved.agent.mode).toBe("draft");
    });

    it("resolves named mode with server", () => {
        const resolved = resolveAgentRuntimeOptions({
            server,
            agent: { mode: "named", agentName: "my-agent" },
        });
        expect(resolved.server).toBe(server);
        expect(resolved.agent).toEqual({ mode: "named", agentName: "my-agent" });
    });
});

describe("mergeAgentSpec", () => {
    it("deep-merges model params", () => {
        const base = {
            model: {
                name: "anthropic/claude-sonnet-4-6",
                params: { maxTokens: 1024, reasoningEffort: "medium" },
            },
        };
        const next = mergeAgentSpec(base, {
            model: { params: { reasoningEffort: "high" } },
        });
        expect(next.model.params).toEqual({ maxTokens: 1024, reasoningEffort: "high" });
    });

    it("replaces mcpServers array wholesale", () => {
        const base: AgentSpec = {
            model: { name: "openai/gpt-4o" },
            mcpServers: [{ id: "github", name: "github" }],
        };
        const next = mergeAgentSpec(base, {
            mcpServers: [{ id: "slack", name: "slack" }],
        });
        expect(next.mcpServers).toEqual([{ id: "slack", name: "slack" }]);
    });

    it("replaces skills array wholesale", () => {
        const base: AgentSpec = {
            model: { name: "openai/gpt-4o" },
            skills: [{ id: "skill-a", name: "skill-a" }],
        };
        const next = mergeAgentSpec(base, {
            skills: [{ id: "skill-b", name: "skill-b" }],
        });
        expect(next.skills).toEqual([{ id: "skill-b", name: "skill-b" }]);
    });

    it("model partial update does not clear mcpServers or skills", () => {
        const base: AgentSpec = {
            model: { name: "openai/gpt-4o", params: { maxTokens: 1024 } },
            mcpServers: [{ id: "github", name: "github" }],
            skills: [{ id: "skill-a", name: "skill-a" }],
        };
        const next = mergeAgentSpec(base, {
            model: { name: "anthropic/claude-sonnet-4-6" },
        });
        expect(next.model.name).toBe("anthropic/claude-sonnet-4-6");
        expect(next.mcpServers).toEqual(base.mcpServers);
        expect(next.skills).toEqual(base.skills);
    });
});
