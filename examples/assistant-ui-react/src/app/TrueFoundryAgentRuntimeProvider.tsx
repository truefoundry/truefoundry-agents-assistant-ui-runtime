"use client";

import { useMemo, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
    trueFoundryAttachmentAdapter,
    useTrueFoundryAgentRuntime,
} from "truefoundry-agents-assistant-ui-runtime";

import { useErrorToaster } from "@truefoundry/agent-ui-sdk";
import {
    getAgentSessionClient,
    getGatewayClient,
} from "@/lib/chat/agentClient";
import { useGatewayCredentials } from "@/lib/chat/gatewayCredentials";
import { DEFAULT_DRAFT_AGENT_SPEC } from "@/lib/draft/defaultAgentSpec";

const DEFAULT_AGENT_NAME = "agent-sdk-test";

export function TrueFoundryAgentRuntimeProvider({
    children,
}: Readonly<{ children: ReactNode }>) {
    const credentials = useGatewayCredentials();
    const params = useParams<{ agentName?: string }>();
    const routeAgentName = params.agentName;
    const mode = routeAgentName != null ? "named" : "draft";
    const { showError } = useErrorToaster();
    const client = useMemo(
        () => getAgentSessionClient(credentials),
        [credentials],
    );
    const gateway = useMemo(
        () => getGatewayClient(credentials),
        [credentials],
    );

    const runtimeOptions = useMemo(() => {
        const shared = {
            client,
            adapters: { attachments: trueFoundryAttachmentAdapter },
            onError: showError,
        } as const;

        if (mode === "draft") {
            return {
                ...shared,
                gateway,
                agent: {
                    mode: "draft" as const,
                    defaultAgentSpec: DEFAULT_DRAFT_AGENT_SPEC,
                },
            };
        }

        return {
            ...shared,
            agent: {
                mode: "named" as const,
                agentName: routeAgentName ?? credentials.agentName ?? DEFAULT_AGENT_NAME,
            },
        };
    }, [client, credentials.agentName, gateway, mode, routeAgentName, showError]);

    const runtime = useTrueFoundryAgentRuntime(runtimeOptions);

    return (
        <AssistantRuntimeProvider key={`${mode}:${routeAgentName ?? "draft"}`} runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}
