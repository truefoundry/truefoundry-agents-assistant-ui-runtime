import { describe, expect, it } from "vitest";

import { mergeAgentSpec } from "./agentSpec.js";
import { resolveTrueFoundryAgentConfig } from "./types.js";

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
});
