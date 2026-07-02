"use client";

import { useMemo } from "react";
import { useAui } from "@assistant-ui/store";

import { trueFoundryExtras, type TrueFoundryDraftRuntimeExtras } from "./truefoundryExtras.js";
import type { RespondToToolApprovalOptions } from "./toolApproval.js";
import type { RespondToToolResponseOptions } from "./toolResponse.js";

/** Pending tool approvals plus a respond action. */
export const useTrueFoundryApprovals = () => {
    const extras = trueFoundryExtras.use((e) => e, undefined);

    return useMemo(
        () => ({
            pending: extras?.pendingApprovals ?? [],
            respond:
                extras?.respondToToolApproval ??
                (() => {
                    throw new Error("TrueFoundry runtime is not ready yet");
                }),
        }),
        [extras],
    );
};

/** Pending ask-user tool responses plus a respond action. */
export const useTrueFoundryToolResponses = () => {
    const extras = trueFoundryExtras.use((e) => e, undefined);

    return useMemo(
        () => ({
            pending: extras?.pendingToolResponses ?? [],
            respond:
                extras?.respondToToolResponse ??
                ((_response: RespondToToolResponseOptions) => {
                    throw new Error("TrueFoundry runtime is not ready yet");
                }),
        }),
        [extras],
    );
};

/** Pending MCP OAuth plus a resume action. */
export const useTrueFoundryMcpAuth = () => {
    const extras = trueFoundryExtras.use((e) => e, undefined);

    return useMemo(
        () => ({
            pending: extras?.pendingMcpAuth ?? null,
            resume:
                extras?.resumeMcpAuth ??
                (async () => {
                    throw new Error("TrueFoundry runtime is not ready yet");
                }),
        }),
        [extras],
    );
};

/** Returns a function to respond to a tool approval from any render context. */
export const useTrueFoundryRespondToToolApproval = () => {
    const aui = useAui();
    return (response: RespondToToolApprovalOptions) =>
        trueFoundryExtras.get(aui).respondToToolApproval(response);
};

/** Returns a function to respond to a pending tool response from any render context. */
export const useTrueFoundryRespondToToolResponse = () => {
    const aui = useAui();
    return (response: RespondToToolResponseOptions) =>
        trueFoundryExtras.get(aui).respondToToolResponse(response);
};

/** Returns a function to resume after MCP OAuth from any render context. */
export const useTrueFoundryResumeMcpAuth = () => {
    const aui = useAui();
    return () => trueFoundryExtras.get(aui).resumeMcpAuth();
};

/** Returns a function to cancel the current run from any render context. */
export const useTrueFoundryCancel = () => {
    const aui = useAui();
    return () => trueFoundryExtras.get(aui).cancel();
};

/** Returns a function to reset (re-submit) a user turn from any render context. */
export const useTrueFoundryResetFromTurn = () => {
    const aui = useAui();
    return (turnId: string) => trueFoundryExtras.get(aui).resetFromTurn(turnId);
};

/** Current draft agent spec and sync state (draft mode only). */
export const useTrueFoundryAgentSpec = () => {
    const extras = trueFoundryExtras.use((e) => e.draft, null);

    return useMemo(
        () => ({
            agentSpec: extras?.agentSpec ?? null,
            draftSessionId: extras?.draftSessionId,
            isSpecSyncing: extras?.isSpecSyncing ?? false,
            specError: extras?.specError ?? null,
            updateAgentSpec:
                extras?.updateAgentSpec ??
                (() => {
                    throw new Error("Draft agent extras are only available in draft mode.");
                }),
        }),
        [extras],
    );
};

/** Returns a draft spec updater from any render context. */
export const useTrueFoundryUpdateAgentSpec = () => {
    const aui = useAui();
    return (update: Parameters<TrueFoundryDraftRuntimeExtras["updateAgentSpec"]>[0]) =>
        trueFoundryExtras.get(aui).draft?.updateAgentSpec(update);
};

