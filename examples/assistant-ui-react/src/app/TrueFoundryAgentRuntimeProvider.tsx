"use client";

import { useMemo, type ReactNode } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
    trueFoundryAttachmentAdapter,
    useTrueFoundryAgentRuntime,
} from "truefoundry-agents-assistant-ui-runtime";

import { useErrorToaster } from "@/components/assistant-ui/error-toaster";
import { getAgentSessionClient } from "@/lib/chat/agentClient";
import { useGatewayCredentials } from "@/lib/chat/gatewayCredentials";

const DEFAULT_AGENT_NAME = "agent-sdk-test";

export function TrueFoundryAgentRuntimeProvider({
    children,
}: Readonly<{ children: ReactNode }>) {
    const credentials = useGatewayCredentials();
    const { showError } = useErrorToaster();
    const client = useMemo(
        () => getAgentSessionClient(credentials),
        [credentials],
    );

    const runtime = useTrueFoundryAgentRuntime({
        client,
        agentName: credentials.agentName ?? DEFAULT_AGENT_NAME,
        adapters: { attachments: trueFoundryAttachmentAdapter },
        onError: showError,
    });

    return (
        <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
    );
}
