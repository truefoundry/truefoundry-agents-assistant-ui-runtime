"use client";

import { useEffect, useState } from "react";
import { PanelLeftIcon } from "lucide-react";

import { AgentsSection } from "@/components/sidebar/AgentsSection";
import { HistorySection } from "@/components/sidebar/HistorySection";
import { NewChatButton } from "@/components/sidebar/NewChatButton";
import { SidebarFooter } from "@/components/sidebar/SidebarFooter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLLAPSED_STORAGE_KEY = "tf_sidebar_collapsed_v1";

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");
    }, []);

    function toggleCollapsed() {
        setCollapsed((prev) => {
            const next = !prev;
            window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
            return next;
        });
    }

    return (
        <aside
            className={cn(
                "border-border flex min-h-0 shrink-0 flex-col overflow-hidden border-r transition-[width] duration-150",
                collapsed ? "w-14" : "w-64",
            )}
        >
            <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
                {!collapsed && <span className="truncate text-sm font-semibold">TrueFoundry</span>}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleCollapsed}
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className="shrink-0"
                >
                    <PanelLeftIcon className="size-4" />
                </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2">
                <NewChatButton collapsed={collapsed} />
                <AgentsSection collapsed={collapsed} />
                <HistorySection collapsed={collapsed} />
            </div>

            <SidebarFooter collapsed={collapsed} />
        </aside>
    );
}
