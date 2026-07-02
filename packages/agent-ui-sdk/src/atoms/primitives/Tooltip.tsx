import type { ComponentProps } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "../lib/cn.js";

export type TooltipProviderProps = ComponentProps<typeof TooltipPrimitive.Provider>;

export function TooltipProvider({ delayDuration = 0, ...props }: TooltipProviderProps) {
    return (
        <TooltipPrimitive.Provider
            data-slot="tooltip-provider"
            delayDuration={delayDuration}
            {...props}
        />
    );
}

export type TooltipProps = ComponentProps<typeof TooltipPrimitive.Root>;

export function Tooltip(props: TooltipProps) {
    return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

export type TooltipTriggerProps = ComponentProps<typeof TooltipPrimitive.Trigger>;

export function TooltipTrigger(props: TooltipTriggerProps) {
    return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

export type TooltipContentProps = ComponentProps<typeof TooltipPrimitive.Content>;

export function TooltipContent({ className, sideOffset = 0, children, ...props }: TooltipContentProps) {
    return (
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
                data-slot="tooltip-content"
                sideOffset={sideOffset}
                className={cn(
                    "z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                    className,
                )}
                {...props}
            >
                {children}
                <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
            </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
    );
}

declare module "../../theme/SlotsProvider.js" {
    interface AtomSlots {
        TooltipProvider: typeof TooltipProvider;
        Tooltip: typeof Tooltip;
        TooltipTrigger: typeof TooltipTrigger;
        TooltipContent: typeof TooltipContent;
    }
}
