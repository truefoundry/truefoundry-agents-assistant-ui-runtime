import { describe, expect, it } from "vitest";

import {
    normalizeAgentSpecForGateway,
    normalizeMcpMount,
    normalizeSkillMount,
} from "./normalizeAgentSpec.js";

describe("normalizeMcpMount", () => {
    it("rebuilds registry mounts and strips FE id / url", () => {
        expect(
            normalizeMcpMount({
                type: "truefoundry-mcp-registry",
                name: "g-calendar",
                id: "fe-row-id",
                url: "https://should-not-leak.example",
                enableTools: ["@all"],
            }),
        ).toEqual({
            type: "truefoundry-mcp-registry",
            name: "g-calendar",
            enableTools: ["@all"],
        });
    });

    it("defaults enableTools to [@all] when missing on typed registry mounts", () => {
        expect(
            normalizeMcpMount({
                type: "truefoundry-mcp-registry",
                name: "github",
                id: "fe-row-id",
            }),
        ).toEqual({
            type: "truefoundry-mcp-registry",
            name: "github",
            enableTools: ["@all"],
        });
    });

    it("maps UI {id,name} catalog rows to registry mounts with enableTools [@all]", () => {
        expect(
            normalizeMcpMount({ id: "deepwiki-mcp", name: "deepwiki-mcp" }),
        ).toEqual({
            type: "truefoundry-mcp-registry",
            name: "deepwiki-mcp",
            enableTools: ["@all"],
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

    it("forwards optional tool selectors without widening enableTools", () => {
        expect(
            normalizeMcpMount({
                type: "truefoundry-mcp-registry",
                name: "github",
                enableTools: ["list_issues"],
                disableTools: ["delete_repo"],
                preloadTools: ["@read-only"],
                requireApprovalForTools: ["@destructive"],
            }),
        ).toEqual({
            type: "truefoundry-mcp-registry",
            name: "github",
            enableTools: ["list_issues"],
            disableTools: ["delete_repo"],
            preloadTools: ["@read-only"],
            requireApprovalForTools: ["@destructive"],
        });
    });

    it("rebuilds inline mounts without FE id", () => {
        expect(
            normalizeMcpMount({
                type: "inline",
                name: "custom",
                url: "https://example.com/mcp",
                id: "fe-row-id",
                enableTools: ["@all"],
            }),
        ).toEqual({
            type: "inline",
            name: "custom",
            url: "https://example.com/mcp",
            enableTools: ["@all"],
        });
    });
});

describe("normalizeSkillMount", () => {
    it("rebuilds registry mounts and strips FE id / display name", () => {
        expect(
            normalizeSkillMount({
                type: "truefoundry-skills-registry",
                fqn: "agent-skill:truefoundry/skills/web:1",
                id: "fe-row-id",
                name: "Web Search",
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

    it("rebuilds git mounts without FE id", () => {
        expect(
            normalizeSkillMount({
                type: "git",
                url: "https://github.com/acme/skills",
                name: "reviewer",
                ref: "main",
                path: "skills/reviewer",
                id: "fe-row-id",
                preload: true,
            }),
        ).toEqual({
            type: "git",
            url: "https://github.com/acme/skills",
            name: "reviewer",
            ref: "main",
            path: "skills/reviewer",
            preload: true,
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
            {
                type: "truefoundry-mcp-registry",
                name: "gmail",
                enableTools: ["@all"],
            },
        ]);
        expect(next.skills).toEqual([
            {
                type: "truefoundry-skills-registry",
                fqn: "agent-skill:truefoundry/skills/web:1",
            },
        ]);
    });
});
