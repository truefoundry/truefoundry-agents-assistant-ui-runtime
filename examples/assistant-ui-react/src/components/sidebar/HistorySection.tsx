"use client";

import { ChevronRightIcon } from "lucide-react";
import { useAui, useAuiState } from "@assistant-ui/react";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HistorySection({
    collapsed,
    onNavigate,
}: {
    collapsed: boolean;
    onNavigate?: () => void;
}) {
    const aui = useAui();
    const isLoading = useAuiState((s) => s.threads.isLoading);
    const isLoadingMore = useAuiState((s) => s.threads.isLoadingMore);
    const hasMore = useAuiState((s) => s.threads.hasMore);
    const threadIds = useAuiState((s) => s.threads.threadIds);
    const threadItems = useAuiState((s) => s.threads.threadItems);
    const mainThreadId = useAuiState((s) => s.threads.mainThreadId);

    if (collapsed) return null;

    const itemsById = new Map(threadItems.map((item) => [item.id, item]));

    return (
        <Collapsible defaultOpen className="mb-2">
            <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <ChevronRightIcon className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                History
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-0.5 pt-0.5">
                {isLoading ? (
                    Array.from({ length: 4 }, (_, i) => (
                        <div key={i} className="px-2.5 py-1.5">
                            <Skeleton className="h-3.5 w-full" />
                        </div>
                    ))
                ) : threadIds.length === 0 ? (
                    <p className="text-muted-foreground px-2.5 py-1.5 text-xs">
                        No history yet.
                    </p>
                ) : (
                    threadIds.map((id) => {
                        const item = itemsById.get(id);
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => {
                                    aui.threads().switchToThread(id);
                                    onNavigate?.();
                                }}
                                className={cn(
                                    "hover:bg-muted truncate rounded-md px-2.5 py-1.5 text-start text-sm",
                                    id === mainThreadId && "bg-muted font-medium",
                                )}
                            >
                                {item?.title ?? "New Chat"}
                            </button>
                        );
                    })
                )}
                {!isLoading &&
                    hasMore &&
                    (isLoadingMore ? (
                        <div className="px-2.5 py-1.5">
                            <Skeleton className="h-3.5 w-full" />
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground justify-center"
                            onClick={() => void aui.threads().loadMore()}
                        >
                            Load more
                        </Button>
                    ))}
            </CollapsibleContent>
        </Collapsible>
    );
}
