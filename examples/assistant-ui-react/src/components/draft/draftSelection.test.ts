import { describe, expect, it } from "vitest";

import {
    isConnectorSelected,
    isSkillSelected,
    removeConnectorByName,
    removeSkillByFqn,
    toggleConnector,
    toggleSkill,
} from "./draftSelection";

const connector = {
    id: "1",
    name: "GitHub",
    mcpName: "github",
    serverId: "srv-1",
    authenticated: true,
    perUser: false,
    noAuthUi: false,
};

const skill = {
    id: "skill-1",
    versionId: "ver-1",
    name: "Code Review",
    mlRepo: "acme",
    fqn: "acme/agents/code-review:1",
};

describe("draftSelection", () => {
    it("toggleConnector adds and removes by mcpName", () => {
        const empty: [] = [];
        const added = toggleConnector(empty, connector, true);
        expect(added).toEqual([{ name: "github", enableTools: ["@all"] }]);
        expect(isConnectorSelected(added, "github")).toBe(true);

        const removed = toggleConnector(added, connector, false);
        expect(removed).toEqual([]);
        expect(isConnectorSelected(removed, "github")).toBe(false);
    });

    it("removeConnectorByName filters by name", () => {
        const selected = [
            { name: "github", enableTools: ["@all"] },
            { name: "slack", enableTools: ["@all"] },
        ];
        expect(removeConnectorByName(selected, "github")).toEqual([
            { name: "slack", enableTools: ["@all"] },
        ]);
    });

    it("toggleSkill adds and removes by fqn", () => {
        const empty: [] = [];
        const added = toggleSkill(empty, skill, true);
        expect(added).toEqual([{ fqn: skill.fqn, preload: false }]);
        expect(isSkillSelected(added, skill.fqn)).toBe(true);

        const removed = toggleSkill(added, skill, false);
        expect(removed).toEqual([]);
        expect(isSkillSelected(removed, skill.fqn)).toBe(false);
    });

    it("removeSkillByFqn filters by fqn", () => {
        const selected = [
            { fqn: "acme/a:1", preload: false },
            { fqn: "acme/b:2", preload: false },
        ];
        expect(removeSkillByFqn(selected, "acme/a:1")).toEqual([
            { fqn: "acme/b:2", preload: false },
        ]);
    });
});
