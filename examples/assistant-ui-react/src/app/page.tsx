"use client";

import {
    Thread,
    ThreadContainer,
    ThreadListContainer as ThreadList,
} from "@truefoundry/agent-ui-sdk";

import { AgentModeToggle } from "@/components/draft/AgentModeToggle";
import { DraftComposerContainer } from "@/components/draft/DraftComposerContainer";
import { useAgentMode } from "@/lib/draft/agentMode";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function Home() {
    const { mode } = useAgentMode();
    const { tenantName, logout } = useAuth();

    return (
        <main className="flex h-dvh overflow-hidden">
            <aside className="border-border flex min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r">
                <AgentModeToggle />
                <ThreadList />
                <div className="border-border flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                    <span className="truncate">{tenantName}</span>
                    <button
                        type="button"
                        onClick={() => void logout()}
                        className="shrink-0 hover:text-foreground"
                    >
                        Log out
                    </button>
                </div>
            </aside>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {mode === "draft" ? (
                    <ThreadContainer composer={<DraftComposerContainer />} />
                ) : (
                    <Thread />
                )}
            </div>
        </main>
    );
}
