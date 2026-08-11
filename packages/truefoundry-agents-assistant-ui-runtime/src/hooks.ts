"use client";

import { useMemo } from "react";
import { useAui, useAuiState } from "@assistant-ui/store";

import type { AgentMessageCustomMetadata } from "./messageCustomMetadata.js";
import {
    EMPTY_DRAFT_EXTRAS,
    agentExtras,
    type DraftRuntimeExtras,
} from "./agentExtras.js";
import type { RespondToToolApprovalOptions } from "./toolApproval.js";
import type { RespondToToolResponseOptions } from "./toolResponse.js";

/** Pending tool approvals plus a respond action. */
export const useApprovals = () => {
    const extras = agentExtras.use((e) => e, undefined);

    return useMemo(
        () => ({
            pending: extras?.pendingApprovals ?? [],
            respond:
                extras?.respondToToolApproval ??
                (() => {
                    throw new Error("Agent runtime is not ready yet");
                }),
        }),
        [extras],
    );
};

/** Pending ask-user tool responses plus a respond action. */
export const useToolResponses = () => {
    const extras = agentExtras.use((e) => e, undefined);

    return useMemo(
        () => ({
            pending: extras?.pendingToolResponses ?? [],
            respond:
                extras?.respondToToolResponse ??
                ((_response: RespondToToolResponseOptions) => {
                    throw new Error("Agent runtime is not ready yet");
                }),
        }),
        [extras],
    );
};

/** Pending MCP OAuth plus a resume action. */
export const useMcpAuth = () => {
    const extras = agentExtras.use((e) => e, undefined);

    return useMemo(
        () => ({
            pending: extras?.pendingMcpAuth ?? null,
            resume:
                extras?.resumeMcpAuth ??
                (async () => {
                    throw new Error("Agent runtime is not ready yet");
                }),
        }),
        [extras],
    );
};

/** Returns a function to respond to a tool approval from any render context. */
export const useRespondToToolApproval = () => {
    const aui = useAui();
    return (response: RespondToToolApprovalOptions) =>
        agentExtras.get(aui).respondToToolApproval(response);
};

/** Returns a function to respond to a pending tool response from any render context. */
export const useRespondToToolResponse = () => {
    const aui = useAui();
    return (response: RespondToToolResponseOptions) =>
        agentExtras.get(aui).respondToToolResponse(response);
};

/** Returns a function to resume after MCP OAuth from any render context. */
export const useResumeMcpAuth = () => {
    const aui = useAui();
    return () => agentExtras.get(aui).resumeMcpAuth();
};

/** Current sandboxId for this session, if a sandbox has been created. */
export const useSandboxId = (): string | undefined =>
    agentExtras.use((e) => e.sandboxId, undefined);

/** Turn that produced the message being rendered. Only defined inside a message scope. */
export const useTurnId = (): string | undefined =>
    useAuiState(
        (state) =>
            (state.message.metadata?.custom as AgentMessageCustomMetadata | undefined)
                ?.turnId,
    );

/**
 * Returns a function to download a file the current turn wrote to its sandbox. Must be called
 * from a message scope, since the artifact belongs to the turn that rendered it.
 */
export const useDownloadSandboxFile = () => {
    const aui = useAui();
    const turnId = useTurnId();
    return (path: string) => {
        if (turnId == null) {
            throw new Error(
                "Downloading a sandbox file requires a message scope to resolve its turn.",
            );
        }
        return agentExtras.get(aui).downloadSandboxFile({ turnId, path });
    };
};

/** Returns a function to cancel the current run from any render context. */
export const useCancel = () => {
    const aui = useAui();
    return () => agentExtras.get(aui).cancel();
};

/** Returns a function to reload (retry) the current session from any render context. */
export const useReload = () => {
    const aui = useAui();
    return () => agentExtras.get(aui).reload();
};

/** Older history pagination state plus a load-more action for scroll-up. */
export const useHistoryPagination = () => {
    const extras = agentExtras.use((e) => e, undefined);

    return useMemo(
        () => ({
            hasOlderHistory: extras?.hasOlderHistory ?? false,
            isLoadingOlderHistory: extras?.isLoadingOlderHistory ?? false,
            loadOlderHistory:
                extras?.loadOlderHistory ??
                (async () => {
                    throw new Error("Agent runtime is not ready yet");
                }),
        }),
        [extras],
    );
};

/** Returns a function to reset (re-submit) a user turn from any render context. */
export const useResetFromTurn = () => {
    const aui = useAui();
    return (turnId: string) => agentExtras.get(aui).resetFromTurn(turnId);
};

/** Current draft agent spec and sync state (draft mode only). */
export const useAgentSpec = () => {
    const extras = agentExtras.use((e) => e.draft, null);

    return useMemo(
        () => ({ ...EMPTY_DRAFT_EXTRAS, ...extras }),
        [extras],
    );
};

/** Returns a draft spec updater from any render context. */
export const useUpdateAgentSpec = () => {
    const aui = useAui();
    return (update: Parameters<DraftRuntimeExtras["updateAgentSpec"]>[0]) =>
        agentExtras.get(aui).draft?.updateAgentSpec(update);
};

