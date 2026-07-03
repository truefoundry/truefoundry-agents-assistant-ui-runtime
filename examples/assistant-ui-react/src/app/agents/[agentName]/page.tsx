"use client";

import { Thread } from "@truefoundry/agent-ui-sdk";

import { ChatShell } from "@/components/sidebar/ChatShell";

export default function AgentChatPage() {
    return (
        <ChatShell>
            <Thread />
        </ChatShell>
    );
}
