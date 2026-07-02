"use client";

import {
    Thread,
    ThreadContainer,
    ThreadListContainer as ThreadList,
} from "@truefoundry/agent-ui-sdk";

import { AgentModeToggle } from "@/components/draft/AgentModeToggle";
import { DraftComposerContainer } from "@/components/draft/DraftComposerContainer";
import { useAgentMode } from "@/lib/draft/agentMode";

export default function Home() {
    const { mode } = useAgentMode();

    return (
        <main className="flex h-dvh overflow-hidden">
            <aside className="border-border flex min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r">
                <AgentModeToggle />
                <ThreadList />
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
