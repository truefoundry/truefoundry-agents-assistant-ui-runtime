"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { useAui } from "@assistant-ui/react";

import { Button } from "@/components/ui/button";
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
        <Button
            asChild
            variant="ghost"
            className={cn(
                "mb-2 h-8 w-full justify-start gap-2 px-2.5 text-sm font-normal",
                collapsed && "justify-center px-0",
            )}
        >
            <Link
                href="/"
                onClick={() => {
                    aui.threads().switchToNewThread();
                    onNavigate?.();
                }}
            >
                <PlusIcon className="size-4 shrink-0" />
                {!collapsed && <span>New Chat</span>}
            </Link>
        </Button>
    );
}
