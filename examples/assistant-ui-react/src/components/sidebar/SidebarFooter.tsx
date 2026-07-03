"use client";

import { LogOutIcon } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils";

export function SidebarFooter({ collapsed }: { collapsed: boolean }) {
    const { logout } = useAuth();

    return (
        <div
            className={cn(
                "border-sidebar-border flex border-t px-5 py-3",
                collapsed ? "flex-col items-center gap-2 px-2" : "items-center justify-end gap-1",
            )}
        >
            <ThemeToggle className="text-sidebar-foreground" />
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void logout()}
                aria-label="Log out"
                className="text-sidebar-foreground"
            >
                <LogOutIcon className="size-4" />
            </Button>
        </div>
    );
}
