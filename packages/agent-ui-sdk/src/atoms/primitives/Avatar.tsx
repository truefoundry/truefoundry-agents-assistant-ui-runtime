import type { ComponentProps } from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";

import { cn } from "../lib/cn.js";

export type AvatarProps = ComponentProps<typeof AvatarPrimitive.Root> & {
    size?: "default" | "sm" | "lg";
};

export function Avatar({ className, size = "default", ...props }: AvatarProps) {
    return (
        <AvatarPrimitive.Root
            data-slot="avatar"
            data-size={size}
            className={cn(
                "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
                className,
            )}
            {...props}
        />
    );
}

export type AvatarImageProps = ComponentProps<typeof AvatarPrimitive.Image>;

export function AvatarImage({ className, ...props }: AvatarImageProps) {
    return (
        <AvatarPrimitive.Image
            data-slot="avatar-image"
            className={cn("aspect-square size-full rounded-full object-cover", className)}
            {...props}
        />
    );
}

export type AvatarFallbackProps = ComponentProps<typeof AvatarPrimitive.Fallback>;

export function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
    return (
        <AvatarPrimitive.Fallback
            data-slot="avatar-fallback"
            className={cn(
                "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
                className,
            )}
            {...props}
        />
    );
}

declare module "../../theme/SlotsProvider.js" {
    interface AtomSlots {
        Avatar: typeof Avatar;
        AvatarImage: typeof AvatarImage;
        AvatarFallback: typeof AvatarFallback;
    }
}
