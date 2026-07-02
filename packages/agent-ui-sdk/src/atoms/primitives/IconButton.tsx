import { forwardRef, type ComponentPropsWithRef } from "react";
import { Slot } from "radix-ui";

import { cn } from "../lib/cn.js";
import { Button } from "./Button.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./Tooltip.js";

export type IconButtonProps = ComponentPropsWithRef<typeof Button> & {
    tooltip: string;
    side?: "top" | "bottom" | "left" | "right";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ children, tooltip, side = "bottom", className, ...rest }, ref) => {
        return (
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            {...rest}
                            className={cn("aui-button-icon size-6 p-1 active:scale-90", className)}
                            ref={ref}
                        >
                            <Slot.Slottable>{children}</Slot.Slottable>
                            <span className="aui-sr-only sr-only">{tooltip}</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side={side}>{tooltip}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    },
);

IconButton.displayName = "IconButton";

declare module "../../theme/SlotsProvider.js" {
    interface AtomSlots {
        IconButton: typeof IconButton;
    }
}
