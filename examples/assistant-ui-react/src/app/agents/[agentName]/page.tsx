"use client";

import { Thread } from "@truefoundry/agent-ui-sdk";

import { Sidebar } from "@/components/sidebar/Sidebar";

export default function AgentChatPage() {
    return (
        <main className="flex h-dvh overflow-hidden">
            <Sidebar />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <Thread />
            </div>
        </main>
    );
}
