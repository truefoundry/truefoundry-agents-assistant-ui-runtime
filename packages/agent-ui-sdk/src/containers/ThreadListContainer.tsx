"use client";

import { useAui, useAuiState } from "@assistant-ui/react";

import { useSlot } from "../theme/SlotsProvider.js";

/**
 * Simplified relative to the reference: renders threads in a single flat list
 * rather than grouping them by Today/Yesterday/Earlier. Archive/Delete are
 * wired but no-op against the current thread-list adapter (documented in the
 * runtime README's unsupported-features table).
 */
export function ThreadListContainer() {
    const ThreadListShell = useSlot("ThreadListShell");
    const ThreadListNewButton = useSlot("ThreadListNewButton");
    const ThreadListRow = useSlot("ThreadListRow");
    const ThreadListRowSkeleton = useSlot("ThreadListRowSkeleton");
    const ThreadListEmptyState = useSlot("ThreadListEmptyState");
    const Button = useSlot("Button");

    const aui = useAui();
    const isLoading = useAuiState((s) => s.threads.isLoading);
    const isLoadingMore = useAuiState((s) => s.threads.isLoadingMore);
    const hasMore = useAuiState((s) => s.threads.hasMore);
    const threadIds = useAuiState((s) => s.threads.threadIds);
    const threadItems = useAuiState((s) => s.threads.threadItems);
    const mainThreadId = useAuiState((s) => s.threads.mainThreadId);

    const itemsById = new Map(threadItems.map((item) => [item.id, item]));

    return (
        <ThreadListShell header={<ThreadListNewButton onClick={() => aui.threads().switchToNewThread()} />}>
            {isLoading ? (
                <ThreadListRowSkeleton />
            ) : threadIds.length === 0 ? (
                <ThreadListEmptyState />
            ) : (
                threadIds.map((id) => {
                    const item = itemsById.get(id);
                    return (
                        <ThreadListRow
                            key={id}
                            title={item?.title ?? "New Chat"}
                            active={id === mainThreadId}
                            onSelect={() => aui.threads().switchToThread(id)}
                            onArchive={() => aui.threads().item({ id }).archive()}
                            onDelete={() => aui.threads().item({ id }).delete()}
                        />
                    );
                })
            )}
            {!isLoading &&
                hasMore &&
                (isLoadingMore ? (
                    <ThreadListRowSkeleton count={1} />
                ) : (
                    <Button variant="ghost" onClick={() => void aui.threads().loadMore()}>
                        Load more
                    </Button>
                ))}
        </ThreadListShell>
    );
}
