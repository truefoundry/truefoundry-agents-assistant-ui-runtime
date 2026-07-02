import { forwardRef, type ComponentPropsWithRef, type CSSProperties } from "react";

import { cn } from "./lib/cn.js";

const THREAD_CSS_VARS: CSSProperties = {
    ["--thread-max-width" as string]: "44rem",
    ["--composer-bg" as string]: "color-mix(in oklab, var(--color-muted) 30%, var(--color-background))",
    ["--composer-radius" as string]: "1.5rem",
    ["--composer-padding" as string]: "8px",
};

export type ThreadRootShellProps = ComponentPropsWithRef<"div">;

export const ThreadRootShell = forwardRef<HTMLDivElement, ThreadRootShellProps>(
    ({ className, style, ...rest }, ref) => (
        <div
            ref={ref}
            className={cn(
                "aui-root aui-thread-root bg-background @container flex h-full min-h-0 flex-col overflow-hidden",
                className,
            )}
            style={{ ...THREAD_CSS_VARS, ...style }}
            {...rest}
        />
    ),
);
ThreadRootShell.displayName = "ThreadRootShell";

export type ThreadViewportShellProps = ComponentPropsWithRef<"div"> & {
    isEmpty?: boolean;
};

export const ThreadViewportShell = forwardRef<HTMLDivElement, ThreadViewportShellProps>(
    ({ className, isEmpty, children, ...rest }, ref) => (
        <div
            ref={ref}
            data-slot="aui_thread-viewport"
            className={cn("relative flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto scroll-smooth", className)}
            {...rest}
        >
            <div
                className={cn(
                    "mx-auto flex w-full max-w-(--thread-max-width) flex-col px-4 pt-4 pb-4",
                    isEmpty && "min-h-full justify-center",
                )}
            >
                {children}
            </div>
        </div>
    ),
);
ThreadViewportShell.displayName = "ThreadViewportShell";

export type ThreadComposerAreaShellProps = ComponentPropsWithRef<"div"> & {
    isEmpty?: boolean;
};

export const ThreadComposerAreaShell = forwardRef<HTMLDivElement, ThreadComposerAreaShellProps>(
    ({ className, isEmpty, ...rest }, ref) => (
        <div
            ref={ref}
            data-slot="aui_thread-composer"
            className={cn(
                "aui-thread-composer bg-background relative mx-auto flex w-full max-w-(--thread-max-width) shrink-0 flex-col gap-4 px-4 pb-4 md:pb-6",
                !isEmpty && "rounded-t-(--composer-radius)",
                className,
            )}
            {...rest}
        />
    ),
);
ThreadComposerAreaShell.displayName = "ThreadComposerAreaShell";

export type MessageGroupProps = ComponentPropsWithRef<"div">;

export const MessageGroup = forwardRef<HTMLDivElement, MessageGroupProps>(({ className, ...rest }, ref) => (
    <div
        ref={ref}
        data-slot="aui_message-group"
        className={cn("flex flex-col gap-y-6 empty:hidden", className)}
        {...rest}
    />
));
MessageGroup.displayName = "MessageGroup";

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        ThreadRootShell: typeof ThreadRootShell;
        ThreadViewportShell: typeof ThreadViewportShell;
        ThreadComposerAreaShell: typeof ThreadComposerAreaShell;
        MessageGroup: typeof MessageGroup;
    }
}
