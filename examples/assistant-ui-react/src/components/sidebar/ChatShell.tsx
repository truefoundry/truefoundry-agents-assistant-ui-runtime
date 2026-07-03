"use client";

import { useState, type ReactNode } from "react";
import { MenuIcon } from "lucide-react";

import { Sidebar } from "@/components/sidebar/Sidebar";
import { Button } from "@/components/ui/button";

export function ChatShell({ children }: { children: ReactNode }) {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <main className="flex h-dvh overflow-hidden">
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}
            <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="border-border flex items-center gap-2 border-b px-3 py-2 md:hidden">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Open sidebar"
                    >
                        <MenuIcon className="size-4" />
                    </Button>
                    <span className="truncate text-sm font-semibold">TrueFoundry</span>
                </div>
                {children}
            </div>
        </main>
    );
}
