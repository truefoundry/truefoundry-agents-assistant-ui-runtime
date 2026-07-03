"use client";

import { AgentWelcomeScreen } from "@/components/gateway/AgentWelcomeScreen";
import { GatewayDraftWelcomeScreen } from "@/components/gateway/GatewayDraftWelcomeScreen";
import { useRouteAgent } from "@/lib/agents/useRouteAgent";

export function GatewayWelcomeScreen({ className }: { className?: string }) {
    const { agentName } = useRouteAgent();

    if (agentName != null) {
        return <AgentWelcomeScreen className={className} />;
    }

    return <GatewayDraftWelcomeScreen className={className} />;
}
