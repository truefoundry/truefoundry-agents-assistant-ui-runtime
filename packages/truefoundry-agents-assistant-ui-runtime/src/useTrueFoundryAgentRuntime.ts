"use client";

import { useCallback, useMemo, useState } from "react";
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

import {
    collectPendingApprovals,
    collectPendingToolResponses,
    derivePendingMcpAuth,
} from "./collectPending.js";
import { buildUserMessageContent } from "./convertTurnMessages.js";
import { MCP_AUTH_RESUME_RUN_CUSTOM_KEY } from "./mcpAuth.js";
import { createTrueFoundryThreadListAdapter } from "./truefoundryThreadListAdapter.js";
import { trueFoundryExtras } from "./truefoundryExtras.js";
import type { UseTrueFoundryAgentRuntimeOptions } from "./types.js";
import { useTrueFoundryAgentMessages } from "./useTrueFoundryAgentMessages.js";

function useTrueFoundryAgentRuntimeImpl(options: UseTrueFoundryAgentRuntimeOptions) {
    const { client, agentName: _agentName, adapters, onError, listEventsConcurrency, ...sharedOptions } =
        options;

    const sessionId = useAuiState(
        (state) => state.threadListItem.remoteId ?? undefined,
    );
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
    const { client, agentName } = options;

    const threadListAdapter = useMemo(
        () =>
            createTrueFoundryThreadListAdapter({ client, agentName }),
        [client, agentName],
    );

    return useRemoteThreadListRuntime({
        allowNesting: true,
        adapter: threadListAdapter,
        initialThreadId: options.initialSessionId,
        threadId: options.threadId,
        onThreadIdChange: options.onThreadIdChange,
        runtimeHook: () => useTrueFoundryAgentRuntimeImpl(options),
    });
}
