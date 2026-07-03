"use client";

import Link from "next/link";
import { SquarePenIcon } from "lucide-react";
import { useAui } from "@assistant-ui/react";

import { cn } from "@/lib/utils";

export function NewChatButton({
    collapsed,
    onNavigate,
}: {
    collapsed: boolean;
    onNavigate?: () => void;
}) {
    const aui = useAui();

    return (
        <Link
            href="/"
            onClick={() => {
                aui.threads().switchToNewThread();
                onNavigate?.();
            }}
            className={cn(
                "flex shrink-0 h-4 items-center gap-1.5 text-sm font-medium text-sidebar-foreground hover:opacity-80",
                collapsed && "justify-center",
            )}
        >
            <SquarePenIcon className="size-4 shrink-0" />
            {!collapsed && <span>New Chat</span>}
        </Link>
    );
}
