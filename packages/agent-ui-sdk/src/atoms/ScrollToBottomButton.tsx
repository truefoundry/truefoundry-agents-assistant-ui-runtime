import { forwardRef } from "react";
import { ArrowDownIcon } from "lucide-react";

import { cn } from "./lib/cn.js";
import { IconButton, type IconButtonProps } from "./primitives/IconButton.js";

export type ScrollToBottomButtonProps = Omit<IconButtonProps, "tooltip" | "children">;

export const ScrollToBottomButton = forwardRef<HTMLButtonElement, ScrollToBottomButtonProps>(
    ({ className, ...rest }, ref) => {
        return (
            <IconButton
                ref={ref}
                tooltip="Scroll to bottom"
                variant="outline"
                className={cn(
                    "aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-14 z-10 self-center rounded-full p-4 disabled:invisible",
                    className,
                )}
                {...rest}
            >
                <ArrowDownIcon />
            </IconButton>
        );
    },
);

ScrollToBottomButton.displayName = "ScrollToBottomButton";

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        ScrollToBottomButton: typeof ScrollToBottomButton;
    }
}
