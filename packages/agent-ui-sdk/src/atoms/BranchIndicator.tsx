import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "./lib/cn.js";
import { IconButton } from "./primitives/IconButton.js";

export type BranchIndicatorProps = {
    index: number;
    count: number;
    onPrevious: () => void;
    onNext: () => void;
    className?: string;
};

export function BranchIndicator({ index, count, onPrevious, onNext, className }: BranchIndicatorProps) {
    if (count <= 1) return null;

    return (
        <div
            className={cn(
                "aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs",
                className,
            )}
        >
            <IconButton tooltip="Previous" onClick={onPrevious}>
                <ChevronLeftIcon />
            </IconButton>
            <span className="aui-branch-picker-state font-medium">
                {index} / {count}
            </span>
            <IconButton tooltip="Next" onClick={onNext}>
                <ChevronRightIcon />
            </IconButton>
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        BranchIndicator: typeof BranchIndicator;
    }
}
