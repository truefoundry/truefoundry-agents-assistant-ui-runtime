"use client";

import { ThreadContainer } from "@truefoundry/agent-ui-sdk";

import { ChatShell } from "@/components/sidebar/ChatShell";
import { DraftComposerContainer } from "@/components/draft/DraftComposerContainer";

export default function Home() {
    return (
        <ChatShell>
            <ThreadContainer composer={<DraftComposerContainer />} />
        </ChatShell>
    );
}
