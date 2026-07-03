"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

import { AgentOrbAvatar } from "@/components/gateway/AgentOrbAvatar";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgents } from "@/lib/agents/useAgents";
import { cn } from "@/lib/utils";
import {
    sidebarSectionCollapsibleClassName,
    sidebarSectionContentClassName,
} from "@/components/sidebar/sidebarSectionLayout";

export function AgentsSection({
    collapsed,
    onNavigate,
}: {
    collapsed: boolean;
    onNavigate?: () => void;
}) {
    const params = useParams<{ agentName?: string }>();
    const { agents, isLoading, error } = useAgents();

    if (collapsed) return null;

    return (
        <Collapsible defaultOpen className={sidebarSectionCollapsibleClassName}>
            <CollapsibleTrigger className="group flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <span>Agents</span>
                <ChevronDownIcon className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent className={cn("mt-2", sidebarSectionContentClassName)}>
                <div className="flex flex-col gap-1 pr-0.5">
                {isLoading ? (
                    Array.from({ length: 3 }, (_, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <Skeleton className="size-5 shrink-0 rounded-[10px]" />
                            <div className="flex flex-1 flex-col gap-1">
                                <Skeleton className="h-3.5 w-28" />
                                <Skeleton className="h-3 w-full" />
                            </div>
                        </div>
                    ))
                ) : error != null ? (
                    <p className="text-destructive text-xs">{error}</p>
                ) : agents.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No agents found.</p>
                ) : (
                    agents.map((agent, index) => {
                        const active = params.agentName === agent.name;
                        const description =
                            agent.description.trim() ||
                            agent.instruction.trim().slice(0, 36);

                        return (
                            <Link
                                key={agent.id}
                                href={`/agents/${agent.name}`}
                                onClick={() => onNavigate?.()}
                                className={cn(
                                    "flex items-start gap-1.5 rounded-lg px-1.5 py-1 transition-colors",
                                    active
                                        ? "bg-accent"
                                        : "hover:bg-accent/50",
                                )}
                            >
                                <AgentOrbAvatar label={agent.title} index={index} />
                                <span className="min-w-0 flex-1">
                                    <span
                                        className={cn(
                                            "block truncate text-sm text-foreground",
                                            active && "font-medium",
                                        )}
                                    >
                                        {agent.title}
                                    </span>
                                    {description && (
                                        <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                                            {description}
                                            {description.length >= 36 ? ".." : ""}
                                        </span>
                                    )}
                                </span>
                            </Link>
                        );
                    })
                )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
