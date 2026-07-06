import { createRuntimeExtras } from "@assistant-ui/core/internal";
import type { McpAuthRequiredEvent } from "truefoundry-gateway-sdk/agents";

import type { AgentSpec, AgentSpecUpdate } from "./agentSpec.js";
import type { PendingApproval, PendingToolResponse } from "./collectPending.js";
import type { RespondToToolApprovalOptions } from "./toolApproval.js";
import type { RespondToToolResponseOptions } from "./toolResponse.js";

export type { PendingApproval, PendingToolResponse };

export type TrueFoundryDraftRuntimeExtras = {
    agentSpec: AgentSpec | null;
    draftSessionId: string | undefined;
    isSpecSyncing: boolean;
    specError: unknown | null;
    updateAgentSpec: (update: AgentSpecUpdate) => void;
};

export type TrueFoundryRuntimeExtras = {
    pendingApprovals: PendingApproval[];
    pendingToolResponses: PendingToolResponse[];
    pendingMcpAuth: { mcpServers: McpAuthRequiredEvent["mcpServers"] } | null;
    sandboxId: string | undefined;
    respondToToolApproval: (response: RespondToToolApprovalOptions) => void;
    respondToToolResponse: (response: RespondToToolResponseOptions) => void;
    resumeMcpAuth: () => Promise<void>;
    downloadSandboxFile: (path: string) => Promise<Blob>;
    cancel: () => Promise<void>;
    resetFromTurn: (turnId: string) => Promise<void>;
    draft: TrueFoundryDraftRuntimeExtras | null;
};

export const trueFoundryExtras = createRuntimeExtras<TrueFoundryRuntimeExtras>(
    "useTrueFoundryAgentRuntime",
);

export const EMPTY_DRAFT_EXTRAS: TrueFoundryDraftRuntimeExtras = {
    agentSpec: null,
    draftSessionId: undefined,
    isSpecSyncing: false,
    specError: null,
    updateAgentSpec: () => {
        throw new Error("Draft agent extras are only available in draft mode.");
    },
};
