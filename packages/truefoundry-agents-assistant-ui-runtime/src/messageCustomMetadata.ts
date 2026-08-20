import type { McpAuthRequiredEvent } from "./server/index.js";

import type { SubAgentCustomMetadata } from "./foldPeerThreads.js";
import { TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY } from "./toolApproval.js";
import { TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY } from "./toolResponse.js";

/** Keys written to `ThreadMessage.metadata.custom` by this runtime adapter. */
export type AgentMessageCustomMetadata = {
    subAgent?: SubAgentCustomMetadata;
    pendingMcpAuth?: true;
    mcpServers?: McpAuthRequiredEvent["mcpServers"];
    sandboxId?: string;
    /** Turn that produced this message. Scopes artifact downloads to their own turn. */
    turnId?: string;
    [TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY]?: string;
    [TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY]?: string;
};

export type SubAgentMessageCustomMetadata = Pick<
    AgentMessageCustomMetadata,
    "subAgent"
>;

export type McpAuthMessageCustomMetadata = Pick<
    AgentMessageCustomMetadata,
    "pendingMcpAuth" | "mcpServers"
>;

export type SandboxMessageCustomMetadata = Pick<AgentMessageCustomMetadata, "sandboxId">;

export type ToolApprovalMessageCustomMetadata = Pick<
    AgentMessageCustomMetadata,
    typeof TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY
>;

export type ToolResponseMessageCustomMetadata = Pick<
    AgentMessageCustomMetadata,
    typeof TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY
>;
