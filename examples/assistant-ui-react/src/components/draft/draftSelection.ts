import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

import type { ConnectorState } from "@/lib/connectors/listMcpServers";
import type { AgentSkill } from "@/lib/skills/listAgentSkills";

export function isConnectorSelected(
    selected: NonNullable<AgentSpec["mcpServers"]>,
    mcpName: string,
): boolean {
    return selected.some((server) => server.name === mcpName);
}

export function toggleConnector(
    selected: NonNullable<AgentSpec["mcpServers"]>,
    connector: ConnectorState,
    checked: boolean,
): NonNullable<AgentSpec["mcpServers"]> {
    if (!checked) {
        return removeConnectorByName(selected, connector.mcpName);
    }
    if (isConnectorSelected(selected, connector.mcpName)) {
        return selected;
    }
    return [...selected, { name: connector.mcpName, enableTools: ["@all"] }];
}

export function removeConnectorByName(
    selected: NonNullable<AgentSpec["mcpServers"]>,
    mcpName: string,
): NonNullable<AgentSpec["mcpServers"]> {
    return selected.filter((server) => server.name !== mcpName);
}

export function isSkillSelected(
    selected: NonNullable<AgentSpec["skills"]>,
    fqn: string,
): boolean {
    return selected.some((skill) => skill.fqn === fqn);
}

export function toggleSkill(
    selected: NonNullable<AgentSpec["skills"]>,
    skill: AgentSkill,
    checked: boolean,
): NonNullable<AgentSpec["skills"]> {
    if (!checked) {
        return removeSkillByFqn(selected, skill.fqn);
    }
    if (isSkillSelected(selected, skill.fqn)) {
        return selected;
    }
    return [...selected, { fqn: skill.fqn, preload: false }];
}

export function removeSkillByFqn(
    selected: NonNullable<AgentSpec["skills"]>,
    fqn: string,
): NonNullable<AgentSpec["skills"]> {
    return selected.filter((skill) => skill.fqn !== fqn);
}

export function connectorMonogram(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return "?";
    return trimmed.charAt(0).toUpperCase();
}

export function skillMonogram(name: string, fqn: string): string {
    const trimmed = name.trim();
    if (trimmed) return trimmed.charAt(0).toUpperCase();
    const segment = fqn.split("/").pop()?.split(":")[0] ?? fqn;
    return segment.charAt(0).toUpperCase() || "?";
}
