import type { ComponentProps } from "react";

import { cn } from "../lib/cn.js";

export type SkeletonProps = ComponentProps<"div">;

export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
    );
}

declare module "../../theme/SlotsProvider.js" {
    interface AtomSlots {
        Skeleton: typeof Skeleton;
    }
}
