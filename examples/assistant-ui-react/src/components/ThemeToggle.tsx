"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
    const { theme, toggleTheme, mounted } = useTheme();

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-7 shrink-0", className)}
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
            {mounted ? (
                theme === "dark" ? (
                    <SunIcon className="size-4" />
                ) : (
                    <MoonIcon className="size-4" />
                )
            ) : (
                <span className="size-4" />
            )}
        </Button>
    );
}
