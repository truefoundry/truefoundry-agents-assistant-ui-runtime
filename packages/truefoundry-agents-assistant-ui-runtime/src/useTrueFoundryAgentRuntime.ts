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

import type { AgentSpec } from "./private/agentSpec.js";
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
import {
    createDraftSessionBridge,
    DRAFT_SESSION_LAST_UPDATED_AT_HEADER,
} from "./private/draftSessionBridge.js";
import { MCP_AUTH_RESUME_RUN_CUSTOM_KEY } from "./mcpAuth.js";
import { createTrueFoundryDraftThreadListAdapter } from "./private/truefoundryDraftThreadListAdapter.js";
import { trueFoundryExtras } from "./truefoundryExtras.js";
import { createTrueFoundryThreadListAdapter } from "./truefoundryThreadListAdapter.js";
import type { UseTrueFoundryAgentRuntimeOptions } from "./types.js";
import { resolveTrueFoundryAgentRuntimeOptions } from "./types.js";
import { useDraftAgentSpec } from "./private/useDraftAgentSpec.js";
import { useTrueFoundryAgentMessages } from "./useTrueFoundryAgentMessages.js";

function useTrueFoundryAgentRuntimeImpl(
    options: ReturnType<typeof resolveTrueFoundryAgentRuntimeOptions>,
    pendingAgentSpecRef: MutableRefObject<AgentSpec | undefined>,
) {
    const {
        server,
        agent,
        adapters,
        onError,
        listEventsConcurrency,
        ...sharedOptions
    } = options;

    const draftBridgeRef = useRef(
        agent.mode === "draft" ? createDraftSessionBridge(server) : null,
    );

    const draftSessionId = useAuiState(
        (state) =>
            agent.mode === "draft"
                ? (state.threadListItem.remoteId ?? undefined)
                : undefined,
    );
    const sessionId = useAuiState((state) => state.threadListItem.remoteId ?? undefined);
    const isMain = useAuiState(
        (state) => state.threads.mainThreadId === state.threadListItem.id,
    );

    const draftSpec = useDraftAgentSpec({
        draftSessionId,
        draftBridge: draftBridgeRef.current,
        defaultAgentSpec:
            agent.mode === "draft" ? agent.defaultAgentSpec : { model: { name: "" } },
        onAgentSpecChange: agent.mode === "draft" ? agent.onAgentSpecChange : undefined,
        onError,
    });

    const takeTurnHeaderTimestampRef = useRef(draftSpec.takeTurnHeaderTimestamp);
    takeTurnHeaderTimestampRef.current = draftSpec.takeTurnHeaderTimestamp;

    const getTurnHeaders = useCallback(async () => {
        if (agent.mode !== "draft") {
            return undefined;
        }
        const updatedAt = await takeTurnHeaderTimestampRef.current();
        if (updatedAt == null) {
            return undefined;
        }
        return { [DRAFT_SESSION_LAST_UPDATED_AT_HEADER]: updatedAt };
    }, [agent.mode]);

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
        isLoadingOlderHistory,
        hasOlderHistory,
        loadOlderHistory,
        sendTurn,
        cancel,
        respondToToolApproval,
        respondToToolResponse,
        resumeRun,
        editFromTurn,
        resetFromTurn,
        retryLoad,
    } = useTrueFoundryAgentMessages({
        server,
        sessionId,
        isMain,
        listEventsConcurrency,
        onError,
        initializeSession,
        getTurnHeaders: agent.mode === "draft" ? getTurnHeaders : undefined,
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
            if (server.downloadSandboxFile == null) {
                throw new Error(
                    "Downloading a sandbox file requires AgentChatServer.downloadSandboxFile.",
                );
            }
            if (sandboxId == null) {
                throw new Error("No sandbox is available yet for this session.");
            }
            return await server.downloadSandboxFile(sandboxId, { path });
        },
        [server, sandboxId],
    );

    const draftExtras = useMemo(() => {
        if (agent.mode !== "draft") {
            return null;
        }
        return {
            agentSpec: draftSpec.agentSpec,
            draftSessionId: draftSpec.draftSessionId,
            isSpecLoading: draftSpec.isSpecLoading,
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
            reload: retryLoad,
            hasOlderHistory,
            isLoadingOlderHistory,
            loadOlderHistory,
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
    const resolved = resolveTrueFoundryAgentRuntimeOptions(options);
    const { server, agent } = resolved;

    const pendingAgentSpecRef = useRef<AgentSpec | undefined>(
        agent.mode === "draft" ? agent.defaultAgentSpec : undefined,
    );

    const agentMode = agent.mode;
    const namedAgentName = agent.mode === "named" ? agent.agentName : undefined;
    const threadListAdapter = useMemo(() => {
        if (agentMode === "draft") {
            const draftAgent = agent as Extract<typeof agent, { mode: "draft" }>;
            return createTrueFoundryDraftThreadListAdapter({
                server,
                defaultAgentSpec: draftAgent.defaultAgentSpec,
                getAgentSpec: () => pendingAgentSpecRef.current ?? draftAgent.defaultAgentSpec,
            });
        }
        return createTrueFoundryThreadListAdapter({
            server,
            agentName: namedAgentName!,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentMode, namedAgentName, server]);

    return useRemoteThreadListRuntime({
        allowNesting: true,
        adapter: threadListAdapter,
        initialThreadId: resolved.initialSessionId,
        threadId: resolved.threadId,
        onThreadIdChange: resolved.onThreadIdChange,
        runtimeHook: () => useTrueFoundryAgentRuntimeImpl(resolved, pendingAgentSpecRef),
    });
}
