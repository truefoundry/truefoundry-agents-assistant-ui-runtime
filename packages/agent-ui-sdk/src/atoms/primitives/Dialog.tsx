import type { ComponentProps } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { cn } from "../lib/cn.js";
import { Button } from "./Button.js";

export type DialogProps = ComponentProps<typeof DialogPrimitive.Root>;

export function Dialog(props: DialogProps) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export type DialogTriggerProps = ComponentProps<typeof DialogPrimitive.Trigger>;

export function DialogTrigger(props: DialogTriggerProps) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

export type DialogPortalProps = ComponentProps<typeof DialogPrimitive.Portal>;

export function DialogPortal(props: DialogPortalProps) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

export type DialogCloseProps = ComponentProps<typeof DialogPrimitive.Close>;

export function DialogClose(props: DialogCloseProps) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export type DialogOverlayProps = ComponentProps<typeof DialogPrimitive.Overlay>;

export function DialogOverlay({ className, ...props }: DialogOverlayProps) {
    return (
        <DialogPrimitive.Overlay
            data-slot="dialog-overlay"
            className={cn(
                "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
                className,
            )}
            {...props}
        />
    );
}

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
};

export function DialogContent({
    className,
    children,
    showCloseButton = true,
    ...props
}: DialogContentProps) {
    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
                data-slot="dialog-content"
                className={cn(
                    "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                    className,
                )}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <DialogPrimitive.Close data-slot="dialog-close" asChild>
                        <Button variant="ghost" className="absolute top-2 right-2" size="icon-sm">
                            <XIcon />
                            <span className="sr-only">Close</span>
                        </Button>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </DialogPortal>
    );
}

export type DialogHeaderProps = ComponentProps<"div">;

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
    return <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />;
}

export type DialogFooterProps = ComponentProps<"div"> & {
    showCloseButton?: boolean;
};

export function DialogFooter({ className, showCloseButton = false, children, ...props }: DialogFooterProps) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn(
                "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
                className,
            )}
            {...props}
        >
            {children}
            {showCloseButton && (
                <DialogPrimitive.Close asChild>
                    <Button variant="outline">Close</Button>
                </DialogPrimitive.Close>
            )}
        </div>
    );
}

export type DialogTitleProps = ComponentProps<typeof DialogPrimitive.Title>;

export function DialogTitle({ className, ...props }: DialogTitleProps) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn("font-heading text-base leading-none font-medium", className)}
            {...props}
        />
    );
}

export type DialogDescriptionProps = ComponentProps<typeof DialogPrimitive.Description>;

export function DialogDescription({ className, ...props }: DialogDescriptionProps) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn(
                "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
                className,
            )}
            {...props}
        />
    );
}

declare module "../../theme/SlotsProvider.js" {
    interface AtomSlots {
        Dialog: typeof Dialog;
        DialogTrigger: typeof DialogTrigger;
        DialogPortal: typeof DialogPortal;
        DialogClose: typeof DialogClose;
        DialogOverlay: typeof DialogOverlay;
        DialogContent: typeof DialogContent;
        DialogHeader: typeof DialogHeader;
        DialogFooter: typeof DialogFooter;
        DialogTitle: typeof DialogTitle;
        DialogDescription: typeof DialogDescription;
    }
}
