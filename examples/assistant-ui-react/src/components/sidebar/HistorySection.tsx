"use client";

import { ChevronDownIcon } from "lucide-react";
import { useAui, useAuiState } from "@assistant-ui/react";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    sidebarSectionCollapsibleClassName,
    sidebarSectionContentClassName,
} from "@/components/sidebar/sidebarSectionLayout";

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
        <Collapsible defaultOpen className={sidebarSectionCollapsibleClassName}>
            <CollapsibleTrigger className="group flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <span>Chats</span>
                <ChevronDownIcon className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent className={cn("mt-4", sidebarSectionContentClassName)}>
                <div className="flex flex-col gap-4 pr-1">
                {isLoading ? (
                    Array.from({ length: 4 }, (_, i) => (
                        <div key={i}>
                            <Skeleton className="h-3.5 w-full" />
                        </div>
                    ))
                ) : threadIds.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No chats yet.</p>
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
                                    "truncate text-left text-sm text-foreground hover:opacity-90",
                                    id === mainThreadId && "font-medium",
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
                        <Skeleton className="h-3.5 w-full" />
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground h-auto justify-start px-0 py-0 text-xs"
                            onClick={() => void aui.threads().loadMore()}
                        >
                            Load more
                        </Button>
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
