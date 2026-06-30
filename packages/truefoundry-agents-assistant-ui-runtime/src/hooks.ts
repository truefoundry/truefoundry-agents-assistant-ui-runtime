"use client";

import { useMemo } from "react";
import { useAui } from "@assistant-ui/store";

import { trueFoundryExtras } from "./truefoundryExtras.js";
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
