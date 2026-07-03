"use client";

import { useParams } from "next/navigation";

import { useAgents } from "@/lib/agents/useAgents";
import type { SampleAgent } from "@/lib/agents/listAgents";

export function useRouteAgent(): {
    agent: SampleAgent | null;
    agentName: string | undefined;
    agentIndex: number;
    isLoading: boolean;
} {
    const params = useParams<{ agentName?: string }>();
    const agentName = params.agentName;
    const { agents, isLoading } = useAgents();

    if (agentName == null) {
        return { agent: null, agentName: undefined, agentIndex: 0, isLoading: false };
    }

    const agentIndex = agents.findIndex((entry) => entry.name === agentName);
    const agent = agentIndex >= 0 ? agents[agentIndex]! : null;

    return { agent, agentName, agentIndex, isLoading };
}
