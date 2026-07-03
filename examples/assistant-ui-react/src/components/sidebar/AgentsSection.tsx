"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgents } from "@/lib/agents/useAgents";
import { cn } from "@/lib/utils";

function initials(title: string): string {
    const words = title.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "??";
    if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
    return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

export function AgentsSection({ collapsed }: { collapsed: boolean }) {
    const params = useParams<{ agentName?: string }>();
    const { agents, isLoading, error } = useAgents();

    if (collapsed) return null;

    return (
        <Collapsible defaultOpen className="mb-2">
            <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <ChevronRightIcon className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                Agents
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-0.5 pt-0.5">
                {isLoading ? (
                    Array.from({ length: 4 }, (_, i) => (
                        <div key={i} className="flex items-center gap-2 px-2.5 py-1.5">
                            <Skeleton className="size-6 shrink-0 rounded-md" />
                            <Skeleton className="h-3.5 flex-1" />
                        </div>
                    ))
                ) : error != null ? (
                    <p className="text-destructive px-2.5 py-1.5 text-xs">{error}</p>
                ) : agents.length === 0 ? (
                    <p className="text-muted-foreground px-2.5 py-1.5 text-xs">
                        No agents found.
                    </p>
                ) : (
                    agents.map((agent) => {
                        const active = params.agentName === agent.name;
                        return (
                            <Link
                                key={agent.id}
                                href={`/agents/${agent.name}`}
                                className={cn(
                                    "hover:bg-muted flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
                                    active && "bg-muted font-medium",
                                )}
                            >
                                <span className="bg-secondary text-secondary-foreground flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold">
                                    {initials(agent.title)}
                                </span>
                                <span className="truncate">{agent.title}</span>
                            </Link>
                        );
                    })
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}
