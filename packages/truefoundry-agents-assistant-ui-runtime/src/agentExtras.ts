import { createRuntimeExtras } from "@assistant-ui/core/internal";
import type { McpAuthRequiredEvent } from "./server/index.js";

import type { AgentSpec } from "./server/types.js";
import type { AgentSpecUpdate } from "./draft/agentSpec.js";
import type { PendingApproval, PendingToolResponse } from "./collectPending.js";
import type { RespondToToolApprovalOptions } from "./toolApproval.js";
import type { RespondToToolResponseOptions } from "./toolResponse.js";

export type { PendingApproval, PendingToolResponse };

export type DraftRuntimeExtras = {
    agentSpec: AgentSpec | null;
    draftSessionId: string | undefined;
    isSpecLoading: boolean;
    isSpecSyncing: boolean;
    specError: unknown | null;
    updateAgentSpec: (update: AgentSpecUpdate) => void;
};

export type AgentRuntimeExtras = {
    pendingApprovals: PendingApproval[];
    pendingToolResponses: PendingToolResponse[];
    pendingMcpAuth: { mcpServers: McpAuthRequiredEvent["mcpServers"] } | null;
    sandboxId: string | undefined;
    respondToToolApproval: (response: RespondToToolApprovalOptions) => void;
    respondToToolResponse: (response: RespondToToolResponseOptions) => void;
    resumeMcpAuth: () => Promise<void>;
    downloadSandboxFile: (req: { turnId: string; path: string }) => Promise<Blob>;
    cancel: () => Promise<void>;
    resetFromTurn: (turnId: string) => Promise<void>;
    reload: () => void;
    hasOlderHistory: boolean;
    isLoadingOlderHistory: boolean;
    loadOlderHistory: () => Promise<void>;
    draft: DraftRuntimeExtras | null;
};

export const agentExtras = createRuntimeExtras<AgentRuntimeExtras>(
    "useAgentRuntime",
);

export const EMPTY_DRAFT_EXTRAS: DraftRuntimeExtras = {
    agentSpec: null,
    draftSessionId: undefined,
    isSpecLoading: false,
    isSpecSyncing: false,
    specError: null,
    updateAgentSpec: () => {
        throw new Error("Draft agent extras are only available in draft mode.");
    },
};
