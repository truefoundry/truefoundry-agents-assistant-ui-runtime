import { describe, expect, it } from "vitest";

import {
    normalizeAgentSpecForGateway,
    normalizeMcpMount,
    normalizeSkillMount,
} from "./normalizeAgentSpec.js";

describe("normalizeMcpMount", () => {
    it("passes through registry mounts", () => {
        expect(
            normalizeMcpMount({
                type: "truefoundry-mcp-registry",
                name: "g-calendar",
                enableTools: ["@all"],
            }),
        ).toEqual({
            type: "truefoundry-mcp-registry",
            name: "g-calendar",
            enableTools: ["@all"],
        });
    });

    it("maps UI {id,name} catalog rows to registry mounts", () => {
        expect(
            normalizeMcpMount({ id: "deepwiki-mcp", name: "deepwiki-mcp" }),
        ).toEqual({
            type: "truefoundry-mcp-registry",
            name: "deepwiki-mcp",
        });
    });

    it("forwards enableTools / preload / config from catalog rows", () => {
        expect(
            normalizeMcpMount({
                id: "gmail",
                name: "gmail",
                enableTools: ["@read-only"],
                preload: true,
                config: { locale: "en" },
            }),
        ).toEqual({
            type: "truefoundry-mcp-registry",
            name: "gmail",
            enableTools: ["@read-only"],
            preload: true,
            config: { locale: "en" },
        });
    });
});

describe("normalizeSkillMount", () => {
    it("passes through registry mounts", () => {
        expect(
            normalizeSkillMount({
                type: "truefoundry-skills-registry",
                fqn: "agent-skill:truefoundry/skills/web:1",
                preload: false,
            }),
        ).toEqual({
            type: "truefoundry-skills-registry",
            fqn: "agent-skill:truefoundry/skills/web:1",
            preload: false,
        });
    });

    it("maps UI {id,name} rows (id = fqn from CP catalog) to registry mounts", () => {
        expect(
            normalizeSkillMount({
                id: "agent-skill:truefoundry/skills/web:1",
                name: "web",
            }),
        ).toEqual({
            type: "truefoundry-skills-registry",
            fqn: "agent-skill:truefoundry/skills/web:1",
        });
    });

    it("forwards preload / config from catalog rows, including preload false", () => {
        expect(
            normalizeSkillMount({
                id: "agent-skill:truefoundry/skills/web:1",
                name: "web",
                preload: false,
                config: { timeoutMs: 1000 },
            }),
        ).toEqual({
            type: "truefoundry-skills-registry",
            fqn: "agent-skill:truefoundry/skills/web:1",
            preload: false,
            config: { timeoutMs: 1000 },
        });
    });
});

describe("normalizeAgentSpecForGateway", () => {
    it("rewrites UI mount rows so gateway serialization can succeed", () => {
        const next = normalizeAgentSpecForGateway({
            model: { name: "openai-main/gpt-4.1" },
            mcpServers: [{ id: "gmail", name: "gmail" }] as never[],
            skills: [
                {
                    id: "agent-skill:truefoundry/skills/web:1",
                    name: "web",
                },
            ] as never[],
        });

        expect(next.mcpServers).toEqual([
            { type: "truefoundry-mcp-registry", name: "gmail" },
        ]);
        expect(next.skills).toEqual([
            {
                type: "truefoundry-skills-registry",
                fqn: "agent-skill:truefoundry/skills/web:1",
            },
        ]);
    });
});
