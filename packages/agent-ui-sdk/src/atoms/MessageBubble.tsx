import type { ReactNode } from "react";

import { cn } from "./lib/cn.js";

export type AssistantMessageBubbleProps = {
    variant: "assistant";
    children: ReactNode;
    error?: ReactNode;
    branchIndicator?: ReactNode;
    actionBar?: ReactNode;
    className?: string;
};

export type UserMessageBubbleProps = {
    variant: "user";
    children: ReactNode;
    attachments?: ReactNode;
    branchIndicator?: ReactNode;
    className?: string;
};

export type MessageBubbleProps = AssistantMessageBubbleProps | UserMessageBubbleProps;

export function MessageBubble(props: MessageBubbleProps) {
    if (props.variant === "assistant") {
        const { children, error, branchIndicator, actionBar, className } = props;
        return (
            <div
                data-slot="aui_assistant-message-root"
                className={cn("fade-in slide-in-from-bottom-1 animate-in relative duration-150", className)}
            >
                <div
                    data-slot="aui_assistant-message-content"
                    className="text-foreground px-2 leading-relaxed wrap-break-word [contain-intrinsic-size:auto_24px] [content-visibility:auto]"
                >
                    {children}
                    {error}
                </div>
                <div data-slot="aui_assistant-message-footer" className="ms-2 -mb-7.5 min-h-7.5 pt-1.5 flex items-center">
                    {branchIndicator}
                    {actionBar}
                </div>
            </div>
        );
    }

    const { children, attachments, branchIndicator, className } = props;
    return (
        <div
            data-slot="aui_user-message-root"
            className={cn(
                "fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_60px] [content-visibility:auto] [&:where(>*)]:col-start-2",
                className,
            )}
        >
            {attachments}
            <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
                <div className="aui-user-message-content bg-muted text-foreground rounded-xl px-4 py-2 wrap-break-word empty:hidden">
                    {children}
                </div>
            </div>
            {branchIndicator != null && (
                <div
                    data-slot="aui_user-branch-picker"
                    className="col-span-full col-start-1 row-start-3 -me-1 flex justify-end"
                >
                    {branchIndicator}
                </div>
            )}
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        MessageBubble: typeof MessageBubble;
    }
}
