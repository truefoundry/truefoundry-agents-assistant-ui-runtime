import { createRuntimeExtras } from "@assistant-ui/core/internal";
import type { McpAuthRequiredEvent } from "./server/index.js";

import type { AgentSpec } from "./server/types.js";
import type { AgentSpecUpdate } from "./draft/agentSpec.js";
import type { PendingApproval, PendingToolResponse } from "./collectPending.js";
import type { RespondToToolApprovalOptions } from "./toolApproval.js";
import type { RespondToToolResponseOptions } from "./toolResponse.js";

export type { PendingApproval, PendingToolResponse };

export type TrueFoundryDraftRuntimeExtras = {
    agentSpec: AgentSpec | null;
    draftSessionId: string | undefined;
    isSpecLoading: boolean;
    isSpecSyncing: boolean;
    specError: unknown | null;
    updateAgentSpec: (update: AgentSpecUpdate) => void;
    flushAgentSpec: () => Promise<void>;
    adoptAgentSpec: (request: {
        agentSpec: AgentSpec;
        updatedAt?: string;
    }) => void;
};

export type TrueFoundryRuntimeExtras = {
    pendingApprovals: PendingApproval[];
    pendingToolResponses: PendingToolResponse[];
    pendingMcpAuth: { mcpServers: McpAuthRequiredEvent["mcpServers"] } | null;
    resumeUnavailable: boolean;
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
    draft: TrueFoundryDraftRuntimeExtras | null;
};

export const trueFoundryExtras = createRuntimeExtras<TrueFoundryRuntimeExtras>(
    "useTrueFoundryAgentRuntime",
);

export const EMPTY_DRAFT_EXTRAS: TrueFoundryDraftRuntimeExtras = {
    agentSpec: null,
    draftSessionId: undefined,
    isSpecLoading: false,
    isSpecSyncing: false,
    specError: null,
    updateAgentSpec: () => {
        throw new Error("Draft agent extras are only available in draft mode.");
    },
    flushAgentSpec: async () => {
        throw new Error("Draft agent extras are only available in draft mode.");
    },
    adoptAgentSpec: () => {
        throw new Error("Draft agent extras are only available in draft mode.");
    },
};
