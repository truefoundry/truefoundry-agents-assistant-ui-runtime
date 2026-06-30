import type { McpAuthRequiredEvent } from "truefoundry-gateway-sdk/agents";

import type { SubAgentCustomMetadata } from "./foldPeerThreads.js";
import { TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY } from "./toolApproval.js";
import { TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY } from "./toolResponse.js";

/** Keys written to `ThreadMessage.metadata.custom` by this runtime adapter. */
export type TrueFoundryMessageCustomMetadata = {
    subAgent?: SubAgentCustomMetadata;
    pendingMcpAuth?: true;
    mcpServers?: McpAuthRequiredEvent["mcpServers"];
    [TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY]?: string;
    [TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY]?: string;
};

export type SubAgentMessageCustomMetadata = Pick<
    TrueFoundryMessageCustomMetadata,
    "subAgent"
>;

export type McpAuthMessageCustomMetadata = Pick<
    TrueFoundryMessageCustomMetadata,
    "pendingMcpAuth" | "mcpServers"
>;

export type ToolApprovalMessageCustomMetadata = Pick<
    TrueFoundryMessageCustomMetadata,
    typeof TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY
>;

export type ToolResponseMessageCustomMetadata = Pick<
    TrueFoundryMessageCustomMetadata,
    typeof TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY
>;
