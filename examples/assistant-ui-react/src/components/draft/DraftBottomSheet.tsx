"use client";

import type { ReactNode } from "react";
import { Dialog } from "radix-ui";
import { ArrowLeftIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type DraftBottomSheetProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    /** Renders a back arrow instead of the close button; used for drill-down submenus. */
    onBack?: () => void;
    headerEnd?: ReactNode;
    children: ReactNode;
};

/**
 * Mobile counterpart to the desktop composer popovers/dropdowns: a full-width
 * sheet anchored to the bottom of the viewport instead of a floating panel
 * anchored to the trigger, which has no reasonable position on small screens.
 */
export function DraftBottomSheet({
    open,
    onOpenChange,
    title,
    onBack,
    headerEnd,
    children,
}: DraftBottomSheetProps) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className={cn(
                        "fixed inset-0 z-50 bg-black/40",
                        "data-[state=open]:animate-in data-[state=open]:fade-in",
                        "data-[state=closed]:animate-out data-[state=closed]:fade-out",
                    )}
                />
                <Dialog.Content
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    className={cn(
                        "fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl border border-border bg-popover text-popover-foreground shadow-lg outline-none",
                        "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
                        "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
                    )}
                >
                    <div className="flex shrink-0 justify-center pt-2">
                        <div className="h-1 w-9 rounded-full bg-border" />
                    </div>
                    <div className="relative flex shrink-0 items-center justify-center px-3 py-3">
                        {onBack ? (
                            <button
                                type="button"
                                onClick={onBack}
                                aria-label="Back"
                                className="absolute left-2 flex size-8 items-center justify-center rounded-full text-foreground hover:bg-accent/60"
                            >
                                <ArrowLeftIcon className="size-4" />
                            </button>
                        ) : (
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    aria-label="Close"
                                    className="absolute left-2 flex size-8 items-center justify-center rounded-full text-foreground hover:bg-accent/60"
                                >
                                    <XIcon className="size-4" />
                                </button>
                            </Dialog.Close>
                        )}
                        <Dialog.Title className="max-w-[70%] truncate text-sm font-semibold text-foreground">
                            {title}
                        </Dialog.Title>
                        {headerEnd != null && <div className="absolute right-2">{headerEnd}</div>}
                    </div>
                    <div className="flex-1 overflow-y-auto px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                        {children}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
