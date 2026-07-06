"use client";

import { useMemo, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import type { AgentSessionClient } from "truefoundry-gateway-sdk/agents";
import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";
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
import { DEFAULT_DRAFT_AGENT_SPEC, type AgentSpec } from "@/lib/draft/defaultAgentSpec";
import { getStoredModelPreference } from "@/lib/draft/modelPreference";
import { useEnabledModels } from "@/lib/models/useEnabledModels";

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
    // Kept outside the keyed RuntimeScope below so switching agents doesn't
    // re-trigger the enabled-models fetch.
    const { models: enabledModels } = useEnabledModels();

    const defaultDraftAgentSpec = useMemo(() => {
        const storedModel = getStoredModelPreference();
        if (storedModel != null) {
            return { ...DEFAULT_DRAFT_AGENT_SPEC, model: storedModel };
        }
        const firstModel = enabledModels[0];
        if (firstModel != null) {
            return {
                ...DEFAULT_DRAFT_AGENT_SPEC,
                model: { ...DEFAULT_DRAFT_AGENT_SPEC.model, name: firstModel.apiModel },
            };
        }
        return DEFAULT_DRAFT_AGENT_SPEC;
    }, [enabledModels]);

    return (
        <RuntimeScope
            key={`${mode}:${routeAgentName ?? "draft"}`}
            mode={mode}
            routeAgentName={routeAgentName}
            fallbackAgentName={credentials.agentName ?? DEFAULT_AGENT_NAME}
            client={client}
            gateway={gateway}
            defaultDraftAgentSpec={defaultDraftAgentSpec}
            onError={showError}
        >
            {children}
        </RuntimeScope>
    );
}

/**
 * Remounted (via the `key` on the parent) whenever the selected agent
 * changes, so `useTrueFoundryAgentRuntime` builds a brand-new runtime
 * instead of reusing one still pointed at the previous agent's session id.
 */
function RuntimeScope({
    children,
    mode,
    routeAgentName,
    fallbackAgentName,
    client,
    gateway,
    defaultDraftAgentSpec,
    onError,
}: Readonly<{
    children: ReactNode;
    mode: "named" | "draft";
    routeAgentName: string | undefined;
    fallbackAgentName: string;
    client: AgentSessionClient;
    gateway: TrueFoundryGateway;
    defaultDraftAgentSpec: AgentSpec;
    onError: (error: unknown) => void;
}>) {
    const runtimeOptions = useMemo(() => {
        const shared = {
            client,
            adapters: { attachments: trueFoundryAttachmentAdapter },
            onError,
        } as const;

        if (mode === "draft") {
            return {
                ...shared,
                gateway,
                agent: {
                    mode: "draft" as const,
                    defaultAgentSpec: defaultDraftAgentSpec,
                },
            };
        }

        return {
            ...shared,
            gateway,
            agent: {
                mode: "named" as const,
                agentName: routeAgentName ?? fallbackAgentName,
            },
        };
    }, [client, defaultDraftAgentSpec, fallbackAgentName, gateway, mode, onError, routeAgentName]);

    const runtime = useTrueFoundryAgentRuntime(runtimeOptions);

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}
