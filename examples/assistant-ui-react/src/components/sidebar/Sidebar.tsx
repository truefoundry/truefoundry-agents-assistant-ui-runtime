"use client";

import { useEffect, useState } from "react";
import { ChevronsLeftIcon, XIcon } from "lucide-react";

import { AgentsSection } from "@/components/sidebar/AgentsSection";
import { HistorySection } from "@/components/sidebar/HistorySection";
import { NewChatButton } from "@/components/sidebar/NewChatButton";
import { SidebarFooter } from "@/components/sidebar/SidebarFooter";
import { TrueFoundryLogo } from "@/components/gateway/TrueFoundryLogo";
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
                "border-sidebar-border bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-40 flex min-h-0 w-60 shrink-0 flex-col overflow-hidden border-r transition-transform duration-200",
                mobileOpen ? "translate-x-0" : "-translate-x-full",
                "md:static md:z-auto md:translate-x-0 md:transition-[width]",
                effectiveCollapsed ? "md:w-14" : "md:w-60",
            )}
        >
            <div className="flex items-center justify-between px-5 py-5">
                <TrueFoundryLogo collapsed={effectiveCollapsed} />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClose}
                    aria-label="Close sidebar"
                    className="shrink-0 text-sidebar-foreground md:hidden"
                >
                    <XIcon className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleCollapsed}
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className="hidden size-[18px] shrink-0 text-sidebar-foreground md:inline-flex"
                >
                    <ChevronsLeftIcon
                        className={cn("size-3.5", effectiveCollapsed && "rotate-180")}
                    />
                </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5">
                <NewChatButton collapsed={effectiveCollapsed} onNavigate={onClose} />
                <AgentsSection collapsed={effectiveCollapsed} onNavigate={onClose} />
                <HistorySection collapsed={effectiveCollapsed} onNavigate={onClose} />
            </div>

            <SidebarFooter collapsed={effectiveCollapsed} />
        </aside>
    );
}
