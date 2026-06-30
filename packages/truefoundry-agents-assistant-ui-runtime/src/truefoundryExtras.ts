import { createRuntimeExtras } from "@assistant-ui/core/internal";
import type { McpAuthRequiredEvent } from "truefoundry-gateway-sdk/agents";

import type { PendingApproval, PendingToolResponse } from "./collectPending.js";
import type { RespondToToolApprovalOptions } from "./toolApproval.js";
import type { RespondToToolResponseOptions } from "./toolResponse.js";

export type { PendingApproval, PendingToolResponse };

export type TrueFoundryRuntimeExtras = {
    pendingApprovals: PendingApproval[];
    pendingToolResponses: PendingToolResponse[];
    pendingMcpAuth: { mcpServers: McpAuthRequiredEvent["mcpServers"] } | null;
    respondToToolApproval: (response: RespondToToolApprovalOptions) => void;
    respondToToolResponse: (response: RespondToToolResponseOptions) => void;
    resumeMcpAuth: () => Promise<void>;
    cancel: () => Promise<void>;
};

export const trueFoundryExtras = createRuntimeExtras<TrueFoundryRuntimeExtras>(
    "useTrueFoundryAgentRuntime",
);
