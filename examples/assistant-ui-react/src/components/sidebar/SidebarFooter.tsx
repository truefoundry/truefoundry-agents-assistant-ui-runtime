"use client";

import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils";

export function SidebarFooter({ collapsed }: { collapsed: boolean }) {
    const { logout } = useAuth();

    return (
        <div
            className={cn(
                "border-border flex items-center gap-1 border-t px-2 py-2",
                collapsed ? "flex-col" : "justify-end",
            )}
        >
            <ThemeToggle />
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void logout()}
                aria-label="Log out"
            >
                <LogOutIcon className="size-4" />
            </Button>
        </div>
    );
}
