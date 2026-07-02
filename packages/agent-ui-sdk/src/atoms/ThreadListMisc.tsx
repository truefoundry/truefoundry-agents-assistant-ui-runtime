import type { ReactNode } from "react";
import { PlusIcon } from "lucide-react";

import { cn } from "./lib/cn.js";
import { Button, type ButtonProps } from "./primitives/Button.js";
import { Skeleton } from "./primitives/Skeleton.js";

export type ThreadListNewButtonProps = Omit<ButtonProps, "children">;

export function ThreadListNewButton({ className, ...rest }: ThreadListNewButtonProps) {
    return (
        <Button
            variant="ghost"
            data-slot="aui_thread-list-new"
            className={cn("hover:bg-muted h-8 justify-start gap-2 rounded-md px-2.5 text-sm font-normal", className)}
            {...rest}
        >
            <PlusIcon className="size-4 shrink-0" />
            <span className="whitespace-nowrap">New Thread</span>
        </Button>
    );
}

export type ThreadListRowSkeletonProps = {
    count?: number;
    className?: string;
};

export function ThreadListRowSkeleton({ count = 5, className }: ThreadListRowSkeletonProps) {
    return (
        <div className={cn("flex flex-col gap-1", className)} role="status" aria-label="Loading threads">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex h-8 items-center px-2.5">
                    <Skeleton className="h-3.5 w-full" />
                </div>
            ))}
        </div>
    );
}

export type ThreadListEmptyStateProps = {
    message?: string;
    className?: string;
};

export function ThreadListEmptyState({ message = "No threads yet", className }: ThreadListEmptyStateProps) {
    return (
        <div className={cn("text-muted-foreground flex flex-1 items-center justify-center px-4 text-center text-sm", className)}>
            {message}
        </div>
    );
}

export type ThreadListShellProps = {
    header: ReactNode;
    children: ReactNode;
    className?: string;
};

export function ThreadListShell({ header, children, className }: ThreadListShellProps) {
    return (
        <div className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-3", className)}>
            {header}
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-1">{children}</div>
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        ThreadListNewButton: typeof ThreadListNewButton;
        ThreadListRowSkeleton: typeof ThreadListRowSkeleton;
        ThreadListEmptyState: typeof ThreadListEmptyState;
        ThreadListShell: typeof ThreadListShell;
    }
}
