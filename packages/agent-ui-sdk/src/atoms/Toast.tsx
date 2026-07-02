import type { ReactNode } from "react";
import { XIcon } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";

import { cn } from "./lib/cn.js";

export type ToastProps = {
    title: string;
    description: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    className?: string;
};

export function Toast({ title, description, open, onOpenChange, className }: ToastProps) {
    return (
        <ToastPrimitive.Root
            open={open}
            onOpenChange={onOpenChange}
            className={cn(
                "border-destructive bg-background text-destructive dark:bg-card pointer-events-auto relative flex max-h-[min(70vh,32rem)] w-full items-start gap-3 rounded-xl border p-4 shadow-lg dark:text-red-200",
                "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-4",
                className,
            )}
        >
            <div className="grid min-h-0 min-w-0 flex-1 gap-1 overflow-y-auto pe-6">
                <ToastPrimitive.Title className="text-sm leading-none font-semibold">{title}</ToastPrimitive.Title>
                <ToastPrimitive.Description className="font-mono text-sm break-words whitespace-pre-wrap">
                    {description}
                </ToastPrimitive.Description>
            </div>
            <ToastPrimitive.Close className="text-destructive hover:bg-muted focus-visible:ring-ring absolute top-3 right-3 rounded-md p-1 transition-colors focus:outline-none focus-visible:ring-2">
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
            </ToastPrimitive.Close>
        </ToastPrimitive.Root>
    );
}

export type ToastStackProps = {
    children: ReactNode;
    duration?: number;
};

export function ToastStack({ children, duration = Number.POSITIVE_INFINITY }: ToastStackProps) {
    return (
        <ToastPrimitive.Provider duration={duration}>
            {children}
            <ToastPrimitive.Viewport className="fixed inset-x-0 bottom-0 z-50 flex max-h-screen flex-col-reverse gap-2 p-4 sm:bottom-4 sm:left-1/2 sm:w-full sm:max-w-2xl sm:-translate-x-1/2" />
        </ToastPrimitive.Provider>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        Toast: typeof Toast;
        ToastStack: typeof ToastStack;
    }
}
