import type { MessageStatus } from "@assistant-ui/core";
import type { McpAuthRequiredEvent, TurnStateDone } from "truefoundry-gateway-sdk/agents";

import type { AssistantContentPart } from "./modelMessageContent.js";
import type { McpAuthMessageCustomMetadata } from "./messageCustomMetadata.js";

/** `runConfig.custom` flag: resume after MCP OAuth with an empty SDK turn input. */
export const MCP_AUTH_RESUME_RUN_CUSTOM_KEY = "resumeMcpAuth";

type McpServerAuthInfo = McpAuthRequiredEvent["mcpServers"][number];

export function buildMcpAuthTextParts(
    servers: readonly McpServerAuthInfo[],
): AssistantContentPart[] {
    const linkLines = servers.map(
        (server) => `- [Authorize ${server.name}](${server.authUrl})`,
    );
    const text = [
        "This agent needs access to external services before it can continue.",
        "",
        ...linkLines,
        "",
        "Open each link to sign in, then press **Continue** below.",
    ].join("\n");
    return [{ type: "text", text }];
}

export function findMcpAuthRequired(
    requiredActions: TurnStateDone["requiredActions"] | undefined,
): McpAuthRequiredEvent | undefined {
    return requiredActions?.find(
        (action): action is McpAuthRequiredEvent => action.type === "mcp.auth_required",
    );
}

export function mcpAuthAssistantStatus(): MessageStatus {
    return { type: "requires-action", reason: "interrupt" };
}

export function mcpAuthMessageCustom(
    servers: readonly McpServerAuthInfo[],
): McpAuthMessageCustomMetadata {
    return { pendingMcpAuth: true, mcpServers: [...servers] };
}
