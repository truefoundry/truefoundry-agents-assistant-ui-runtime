"use client";

import { useMemo } from "react";
import { useAui, useAuiState } from "@assistant-ui/store";

import type { AgentMessageCustomMetadata } from "./messageCustomMetadata.js";
import {
    EMPTY_DRAFT_EXTRAS,
    getAgentExtras,
    useAgentRuntimeExtras,
    type DraftRuntimeExtras,
} from "./agentExtras.js";
import type { RespondToToolApprovalOptions } from "./toolApproval.js";
import type { RespondToToolResponseOptions } from "./toolResponse.js";

export const useApprovals = () => {
    const extras = useAgentRuntimeExtras();

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
    const extras = useAgentRuntimeExtras();

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
    const extras = useAgentRuntimeExtras();

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
        getAgentExtras(aui).respondToToolApproval(response);
};

export const useRespondToToolResponse = () => {
    const aui = useAui();
    return (response: RespondToToolResponseOptions) =>
        getAgentExtras(aui).respondToToolResponse(response);
};

export const useResumeMcpAuth = () => {
    const aui = useAui();
    return () => getAgentExtras(aui).resumeMcpAuth();
};

export const useSandboxId = (): string | undefined =>
    useAgentRuntimeExtras()?.sandboxId;

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
        return getAgentExtras(aui).downloadSandboxFile({ turnId, path });
    };
};

export const useCancel = () => {
    const aui = useAui();
    return () => getAgentExtras(aui).cancel();
};

export const useReload = () => {
    const aui = useAui();
    return () => getAgentExtras(aui).reload();
};

export const useHistoryPagination = () => {
    const extras = useAgentRuntimeExtras();

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

/**
 * True while a turn runs that this server cannot stream, so its result will not
 * arrive in this client. Falls back to `false` on runtimes that predate the flag.
 */
export const useResumeUnavailable = () =>
    useAgentRuntimeExtras()?.resumeUnavailable ?? false;

export const useResetFromTurn = () => {
    const aui = useAui();
    return (turnId: string) => getAgentExtras(aui).resetFromTurn(turnId);
};

/** Draft agent spec and sync state (draft mode only). */
export const useAgentSpec = () => {
    const extras = useAgentRuntimeExtras()?.draft ?? null;

    return useMemo(
        () => ({ ...EMPTY_DRAFT_EXTRAS, ...extras }),
        [extras],
    );
};

export const useUpdateAgentSpec = () => {
    const aui = useAui();
    return (update: Parameters<DraftRuntimeExtras["updateAgentSpec"]>[0]) =>
        getAgentExtras(aui).draft?.updateAgentSpec(update);
};

/** Flushes any pending draft-spec synchronization before a coordinated write. */
export const useFlushAgentSpec = () => {
    const aui = useAui();
    return () => getAgentExtras(aui).draft?.flushAgentSpec() ?? Promise.resolve();
};

/** Adopts a spec already persisted by another server operation without syncing again. */
export const useAdoptAgentSpec = () => {
    const aui = useAui();
    return (
        request: Parameters<DraftRuntimeExtras["adoptAgentSpec"]>[0],
    ) => getAgentExtras(aui).draft?.adoptAgentSpec(request);
};
