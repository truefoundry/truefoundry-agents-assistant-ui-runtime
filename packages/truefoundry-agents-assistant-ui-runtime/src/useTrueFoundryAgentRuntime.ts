"use client";

import {
    pickExternalStoreSharedOptions,
    type AppendMessage,
    type ToolExecutionStatus,
} from "@assistant-ui/core";
import {
    useExternalStoreRuntime,
    useRemoteThreadListRuntime,
    useRuntimeAdapters,
} from "@assistant-ui/core/react";
import { useAui, useAuiState } from "@assistant-ui/store";
import { useCallback, useMemo, useRef, useState } from "react";

import {
    collectPendingApprovals,
    collectPendingToolResponses,
    derivePendingMcpAuth,
} from "./collectPending.js";
import { buildUserMessageContent } from "./convertTurnMessages.js";
import { createDraftSessionBridge } from "./draftSessionBridge.js";
import { MCP_AUTH_RESUME_RUN_CUSTOM_KEY } from "./mcpAuth.js";
import { createTrueFoundryDraftThreadListAdapter } from "./truefoundryDraftThreadListAdapter.js";
import { trueFoundryExtras } from "./truefoundryExtras.js";
import { createTrueFoundryThreadListAdapter } from "./truefoundryThreadListAdapter.js";
import type { UseTrueFoundryAgentRuntimeOptions } from "./types.js";
import { resolveTrueFoundryAgentRuntimeOptions } from "./types.js";
import { useDraftAgentSpec } from "./useDraftAgentSpec.js";
import { useTrueFoundryAgentMessages } from "./useTrueFoundryAgentMessages.js";

function useTrueFoundryAgentRuntimeImpl(
    options: ReturnType<typeof resolveTrueFoundryAgentRuntimeOptions>,
) {
    const {
        client,
        agent,
        gateway,
        adapters,
        onError,
        listEventsConcurrency,
        ...sharedOptions
    } = options;

    const draftBridgeRef = useRef(
        agent.mode === "draft" && gateway != null
            ? createDraftSessionBridge(gateway)
            : null,
    );

    const draftSessionId = useAuiState(
        (state) =>
            agent.mode === "draft"
                ? (state.threadListItem.remoteId ?? undefined)
                : undefined,
    );
    const sessionId = useAuiState((state) => state.threadListItem.remoteId ?? undefined);

    const draftSpec = useDraftAgentSpec({
        draftSessionId,
        draftBridge: draftBridgeRef.current,
        defaultAgentSpec:
            agent.mode === "draft" ? agent.defaultAgentSpec : { model: { name: "" } },
        onAgentSpecChange: agent.mode === "draft" ? agent.onAgentSpecChange : undefined,
        onError,
    });

    const aui = useAui();
    const initializeSession = useCallback(
        () => aui.threadListItem().initialize(),
        [aui],
    );
    const runtimeAdapters = useRuntimeAdapters();
    const [toolStatuses, setToolStatuses] = useState<
        Record<string, ToolExecutionStatus>
    >({});

    const {
        messages,
        isRunning,
        isLoading,
        sendTurn,
        cancel,
        respondToToolApproval,
        respondToToolResponse,
        resumeRun,
    } = useTrueFoundryAgentMessages({
        client,
        sessionId,
        listEventsConcurrency,
        onError,
        initializeSession,
        draftGateway: agent.mode === "draft" ? gateway : undefined,
    });

    const pendingApprovals = useMemo(
        () => collectPendingApprovals(messages),
        [messages],
    );
    const pendingToolResponses = useMemo(
        () => collectPendingToolResponses(messages),
        [messages],
    );
    const pendingMcpAuth = useMemo(() => derivePendingMcpAuth(messages), [messages]);

    const resumeMcpAuth = useMemo(
        () => () => sendTurn({ resumeMcpAuth: true }),
        [sendTurn],
    );

    const draftExtras = useMemo(() => {
        if (agent.mode !== "draft") {
            return null;
        }
        return {
            agentSpec: draftSpec.agentSpec,
            draftSessionId: draftSpec.draftSessionId,
            isSpecSyncing: draftSpec.isSpecSyncing,
            specError: draftSpec.specError,
            updateAgentSpec: draftSpec.updateAgentSpec,
        };
    }, [agent.mode, draftSpec]);

    return useExternalStoreRuntime({
        ...pickExternalStoreSharedOptions(sharedOptions),
        messages,
        isRunning,
        isLoading,
        extras: trueFoundryExtras.provide({
            pendingApprovals,
            pendingToolResponses,
            pendingMcpAuth,
            respondToToolApproval,
            respondToToolResponse,
            resumeMcpAuth,
            cancel,
            draft: draftExtras,
        }),
        unstable_enableToolInvocations: true,
        setToolStatuses,
        adapters: {
            attachments: adapters?.attachments ?? runtimeAdapters?.attachments,
            speech: adapters?.speech,
            dictation: adapters?.dictation,
            voice: adapters?.voice,
            feedback: adapters?.feedback,
        },
        onNew: async (message: AppendMessage) => {
            if (!(message.startRun ?? message.role === "user")) {
                return;
            }

            const resumeMcpAuthFlag =
                message.runConfig?.custom?.[MCP_AUTH_RESUME_RUN_CUSTOM_KEY] === true;

            if (resumeMcpAuthFlag) {
                await sendTurn({ resumeMcpAuth: true });
                return;
            }

            await sendTurn({ userMessage: buildUserMessageContent(message) });
        },
        onCancel: async () => {
            await cancel();
        },
        onRespondToToolApproval: async (response) => {
            respondToToolApproval(response);
        },
        onResume: async () => {
            await resumeRun();
        },
    });
}

export function useTrueFoundryAgentRuntime(options: UseTrueFoundryAgentRuntimeOptions) {
    const resolved = useMemo(
        () => resolveTrueFoundryAgentRuntimeOptions(options),
        [options],
    );
    const { client, agent, gateway } = resolved;

    const threadListAdapter = useMemo(() => {
        if (agent.mode === "draft") {
            if (gateway == null) {
                throw new Error(
                    "Draft agent mode requires a `gateway` TrueFoundryGateway client.",
                );
            }
            return createTrueFoundryDraftThreadListAdapter({
                gateway,
                defaultAgentSpec: agent.defaultAgentSpec,
            });
        }
        return createTrueFoundryThreadListAdapter({
            client,
            agentName: agent.agentName,
        });
    }, [agent, client, gateway]);

    return useRemoteThreadListRuntime({
        allowNesting: true,
        adapter: threadListAdapter,
        initialThreadId: resolved.initialSessionId,
        threadId: resolved.threadId,
        onThreadIdChange: resolved.onThreadIdChange,
        runtimeHook: () => useTrueFoundryAgentRuntimeImpl(resolved),
    });
}
