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

export const useRespondToToolApproval = () => {
    const aui = useAui();
    return (response: RespondToToolApprovalOptions) =>
        agentExtras.get(aui).respondToToolApproval(response);
};

export const useRespondToToolResponse = () => {
    const aui = useAui();
    return (response: RespondToToolResponseOptions) =>
        agentExtras.get(aui).respondToToolResponse(response);
};

export const useResumeMcpAuth = () => {
    const aui = useAui();
    return () => agentExtras.get(aui).resumeMcpAuth();
};

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
 * Download a file the current turn wrote to its sandbox. Must be called from a
 * message scope so the artifact is scoped to that turn.
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

export const useCancel = () => {
    const aui = useAui();
    return () => agentExtras.get(aui).cancel();
};

export const useReload = () => {
    const aui = useAui();
    return () => agentExtras.get(aui).reload();
};

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

export const useResetFromTurn = () => {
    const aui = useAui();
    return (turnId: string) => agentExtras.get(aui).resetFromTurn(turnId);
};

/** Draft agent spec and sync state (draft mode only). */
export const useAgentSpec = () => {
    const extras = agentExtras.use((e) => e.draft, null);

    return useMemo(
        () => ({ ...EMPTY_DRAFT_EXTRAS, ...extras }),
        [extras],
    );
};

export const useUpdateAgentSpec = () => {
    const aui = useAui();
    return (update: Parameters<DraftRuntimeExtras["updateAgentSpec"]>[0]) =>
        agentExtras.get(aui).draft?.updateAgentSpec(update);
};
