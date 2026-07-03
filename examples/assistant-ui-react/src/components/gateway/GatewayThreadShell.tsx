"use client";

import { forwardRef, type ComponentPropsWithRef, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

const GATEWAY_THREAD_VARS: CSSProperties = {
    ["--thread-max-width" as string]: "50rem",
    ["--composer-radius" as string]: "1rem",
};

export const GatewayThreadRootShell = forwardRef<
    HTMLDivElement,
    ComponentPropsWithRef<"div">
>(({ className, style, ...rest }, ref) => (
    <div
        ref={ref}
        className={cn(
            "aui-root aui-thread-root bg-background @container flex h-full min-h-0 flex-col overflow-hidden",
            className,
        )}
        style={{ ...GATEWAY_THREAD_VARS, ...style }}
        {...rest}
    />
));
GatewayThreadRootShell.displayName = "GatewayThreadRootShell";

export const GatewayThreadViewportShell = forwardRef<
    HTMLDivElement,
    ComponentPropsWithRef<"div"> & { isEmpty?: boolean }
>(({ className, isEmpty, children, ...rest }, ref) => (
    <div
        ref={ref}
        data-slot="aui_thread-viewport"
        className={cn(
            "relative flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto scroll-smooth",
            className,
        )}
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
));
GatewayThreadViewportShell.displayName = "GatewayThreadViewportShell";

export const GatewayThreadComposerAreaShell = forwardRef<
    HTMLDivElement,
    ComponentPropsWithRef<"div"> & { isEmpty?: boolean }
>(({ className, isEmpty, ...rest }, ref) => (
    <div
        ref={ref}
        data-slot="aui_thread-composer"
        className={cn(
            "aui-thread-composer relative mx-auto flex w-full max-w-(--thread-max-width) shrink-0 flex-col gap-4 bg-background px-4 pb-4 md:pb-6",
            !isEmpty && "rounded-t-(--composer-radius)",
            className,
        )}
        {...rest}
    />
));
GatewayThreadComposerAreaShell.displayName = "GatewayThreadComposerAreaShell";
