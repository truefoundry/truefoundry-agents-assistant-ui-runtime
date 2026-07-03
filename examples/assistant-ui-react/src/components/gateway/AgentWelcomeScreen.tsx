"use client";

import { AgentOrbAvatar } from "@/components/gateway/AgentOrbAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouteAgent } from "@/lib/agents/useRouteAgent";
import { cn } from "@/lib/utils";

function agentDescription(agent: {
    description: string;
    instruction: string;
}): string {
    const description = agent.description.trim();
    if (description.length > 0) return description;
    return agent.instruction.trim();
}

export function AgentWelcomeScreen({ className }: { className?: string }) {
    const { agent, agentName, agentIndex, isLoading } = useRouteAgent();

    if (isLoading) {
        return (
            <div
                className={cn(
                    "aui-thread-welcome-root mb-6 flex w-full flex-col items-center gap-4 px-4 text-center",
                    className,
                )}
            >
                <Skeleton className="size-12 rounded-full" />
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-full max-w-md" />
            </div>
        );
    }

    const title = agent?.title ?? agentName ?? "Agent";
    const description =
        agent != null
            ? agentDescription(agent)
            : "Start a conversation with this agent.";

    return (
        <div
            className={cn(
                "aui-thread-welcome-root mb-6 flex w-full flex-col items-center gap-4 px-4 text-center",
                className,
            )}
        >
            <AgentOrbAvatar label={title} index={agentIndex} size="lg" />
            <div className="flex max-w-xl flex-col items-center gap-2">
                <h1 className="text-2xl font-semibold leading-tight text-foreground">
                    {title}
                </h1>
                {description.length > 0 && (
                    <p className="text-sm leading-5 text-muted-foreground">{description}</p>
                )}
            </div>
        </div>
    );
}
