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
import type { MutableRefObject } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

import type { AgentSpec } from "./agentSpec.js";
import {
    collectPendingApprovals,
    collectPendingToolResponses,
    derivePendingMcpAuth,
    deriveSandboxId,
} from "./collectPending.js";
import {
    buildUserMessageContent,
    extractEditedText,
    parseTurnIdFromMessageId,
} from "./convertTurnMessages.js";
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
    pendingAgentSpecRef: MutableRefObject<AgentSpec | undefined>,
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
        editFromTurn,
        resetFromTurn,
    } = useTrueFoundryAgentMessages({
        client,
        sessionId,
        listEventsConcurrency,
        onError,
        initializeSession,
        draftGateway: agent.mode === "draft" ? gateway : undefined,
    });

    if (agent.mode === "draft" && draftSpec.agentSpec != null) {
        pendingAgentSpecRef.current = draftSpec.agentSpec;
    }

    const pendingApprovals = useMemo(
        () => collectPendingApprovals(messages),
        [messages],
    );
    const pendingToolResponses = useMemo(
        () => collectPendingToolResponses(messages),
        [messages],
    );
    const pendingMcpAuth = useMemo(() => derivePendingMcpAuth(messages), [messages]);
    const sandboxId = useMemo(() => deriveSandboxId(messages), [messages]);

    const resumeMcpAuth = useMemo(
        () => () => sendTurn({ resumeMcpAuth: true }),
        [sendTurn],
    );

    const downloadSandboxFile = useCallback(
        async (path: string) => {
            if (gateway == null) {
                const error = new Error(
                    "Downloading a sandbox file requires a `gateway` TrueFoundryGateway client.",
                );
                onError?.(error);
                throw error;
            }
            if (sandboxId == null) {
                const error = new Error("No sandbox is available yet for this session.");
                onError?.(error);
                throw error;
            }
            const response = await gateway.agents.downloadSandboxFile(sandboxId, { path });
            return await response.blob();
        },
        [gateway, sandboxId, onError],
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
            sandboxId,
            respondToToolApproval,
            respondToToolResponse,
            resumeMcpAuth,
            downloadSandboxFile,
            cancel,
            resetFromTurn: (turnId: string) =>
                resetFromTurn(turnId).catch((error) => {
                    onError?.(error);
                }),
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
        onEdit: async (message: AppendMessage) => {
            const sourceId = message.sourceId;
            if (sourceId == null) {
                throw new Error("Could not resolve edited user message.");
            }
            const turnId = parseTurnIdFromMessageId(sourceId);
            const editedText = extractEditedText(message);
            try {
                await editFromTurn(turnId, editedText);
            } catch (error) {
                onError?.(error);
                throw error;
            }
        },
    });
}

export function useTrueFoundryAgentRuntime(options: UseTrueFoundryAgentRuntimeOptions) {
    const resolved = useMemo(
        () => resolveTrueFoundryAgentRuntimeOptions(options),
        [options],
    );
    const { client, agent, gateway } = resolved;

    const pendingAgentSpecRef = useRef<AgentSpec | undefined>(
        agent.mode === "draft" ? agent.defaultAgentSpec : undefined,
    );

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
                getAgentSpec: () => pendingAgentSpecRef.current ?? agent.defaultAgentSpec,
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
        runtimeHook: () => useTrueFoundryAgentRuntimeImpl(resolved, pendingAgentSpecRef),
    });
}
