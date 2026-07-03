"use client";

import Image from "next/image";

import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function TrueFoundryLogo({
    collapsed,
    className,
}: {
    collapsed?: boolean;
    className?: string;
}) {
    const { theme, mounted } = useTheme();
    const wordmarkSrc =
        mounted && theme === "dark"
            ? "/brand/truefoundry-wordmark-dark.svg"
            : "/brand/truefoundry-wordmark.svg";

    return (
        <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
            <Image
                src="/brand/cube.svg"
                alt=""
                width={17}
                height={17}
                className="size-[17px] shrink-0"
                aria-hidden
            />
            {!collapsed && (
                <Image
                    src={wordmarkSrc}
                    alt="truefoundry"
                    width={103}
                    height={18}
                    className="h-[18px] w-auto shrink-0"
                />
            )}
        </div>
    );
}
