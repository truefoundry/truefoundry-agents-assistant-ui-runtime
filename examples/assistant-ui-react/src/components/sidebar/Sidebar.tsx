"use client";

import { useEffect, useState } from "react";
import { PanelLeftIcon, XIcon } from "lucide-react";

import { AgentsSection } from "@/components/sidebar/AgentsSection";
import { HistorySection } from "@/components/sidebar/HistorySection";
import { NewChatButton } from "@/components/sidebar/NewChatButton";
import { SidebarFooter } from "@/components/sidebar/SidebarFooter";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";

const COLLAPSED_STORAGE_KEY = "tf_sidebar_collapsed_v1";

export function Sidebar({
    mobileOpen,
    onClose,
}: {
    mobileOpen: boolean;
    onClose: () => void;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const isMobile = useIsMobile();
    const effectiveCollapsed = collapsed && !isMobile;

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
                "border-border bg-background fixed inset-y-0 left-0 z-40 flex min-h-0 w-72 shrink-0 flex-col overflow-hidden border-r transition-transform duration-200",
                mobileOpen ? "translate-x-0" : "-translate-x-full",
                "md:static md:z-auto md:translate-x-0 md:transition-[width]",
                effectiveCollapsed ? "md:w-14" : "md:w-64",
            )}
        >
            <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
                {!effectiveCollapsed && (
                    <span className="truncate text-sm font-semibold">TrueFoundry</span>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClose}
                    aria-label="Close sidebar"
                    className="shrink-0 md:hidden"
                >
                    <XIcon className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleCollapsed}
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className="hidden shrink-0 md:inline-flex"
                >
                    <PanelLeftIcon className="size-4" />
                </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2">
                <NewChatButton collapsed={effectiveCollapsed} onNavigate={onClose} />
                <AgentsSection collapsed={effectiveCollapsed} onNavigate={onClose} />
                <HistorySection collapsed={effectiveCollapsed} onNavigate={onClose} />
            </div>

            <SidebarFooter collapsed={effectiveCollapsed} />
        </aside>
    );
}
