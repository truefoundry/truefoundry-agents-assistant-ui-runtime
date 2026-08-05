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
