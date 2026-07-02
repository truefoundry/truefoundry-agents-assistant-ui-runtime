"use client";

import {
    ComposerPrimitive,
    MessagePrimitive,
    useAuiState,
} from "@assistant-ui/react";
import { useThreadIsRunning } from "@assistant-ui/core/react";

import { useSlot } from "../theme/SlotsProvider.js";
import { MessageAttachmentsContainer } from "./AttachmentsContainer.js";
import { cn } from "../atoms/lib/cn.js";

function ReadOnlyMessageAttachments() {
    const hasAttachments = useAuiState(
        (s) => (s.message.attachments?.length ?? 0) > 0,
    );
    if (!hasAttachments) {
        return null;
    }
    return (
        <div className="pointer-events-none opacity-90">
            <MessageAttachmentsContainer />
        </div>
    );
}

export function UserEditComposerContainer() {
    const Button = useSlot("Button");
    const isRunning = useThreadIsRunning();

    return (
        <MessagePrimitive.Root data-role="user">
            <div
                data-slot="aui_user-edit-composer-root"
                className="fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [&:where(>*)]:col-start-2"
            >
                <ReadOnlyMessageAttachments />
                <ComposerPrimitive.Root asChild>
                    <div className="aui-user-edit-composer col-start-2 min-w-0">
                        <div className="ring-primary/60 bg-muted rounded-xl px-4 py-3 ring-2">
                            <ComposerPrimitive.Input
                                disabled={isRunning}
                                className="placeholder:text-muted-foreground/80 max-h-32 min-h-10 w-full resize-none bg-transparent text-base outline-none"
                            />
                            <div className="mt-3 flex items-end justify-between gap-3">
                                <p className="text-muted-foreground text-xs">
                                    <kbd className="bg-background/60 rounded border px-1 py-0.5 font-sans text-[10px]">
                                        Enter
                                    </kbd>{" "}
                                    to save{" "}
                                    <kbd className="bg-background/60 rounded border px-1 py-0.5 font-sans text-[10px]">
                                        Esc
                                    </kbd>{" "}
                                    to cancel
                                </p>
                                <div className="flex items-center gap-2">
                                    <ComposerPrimitive.Cancel asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground h-8 px-2"
                                        >
                                            Cancel
                                        </Button>
                                    </ComposerPrimitive.Cancel>
                                    <ComposerPrimitive.Send asChild>
                                        <Button
                                            type="button"
                                            size="sm"
                                            className={cn("h-8 rounded-lg px-3")}
                                            disabled={isRunning}
                                        >
                                            Send
                                        </Button>
                                    </ComposerPrimitive.Send>
                                </div>
                            </div>
                        </div>
                    </div>
                </ComposerPrimitive.Root>
            </div>
        </MessagePrimitive.Root>
    );
}
