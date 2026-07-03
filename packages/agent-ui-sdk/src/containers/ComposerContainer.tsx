"use client";

import { useRef } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { useTrueFoundryCancel, useTrueFoundryToolResponses } from "truefoundry-agents-assistant-ui-runtime";

import { useComposerBusyState } from "../hooks/useComposerBusyState.js";
import { useSlot } from "../theme/SlotsProvider.js";
import { ComposerAttachmentsContainer } from "./AttachmentsContainer.js";
import { AskUserContainer } from "./AskUserContainer.js";
import { McpAuthContainer } from "./McpAuthContainer.js";

const threadHasPendingMcpAuth = (s: { thread: { messages: readonly { role: string; status?: { type: string }; metadata?: { custom?: unknown } }[] } }) => {
    const messages = s.thread.messages;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant") return false;
    if (last.status?.type !== "requires-action") return false;
    return (last.metadata?.custom as { pendingMcpAuth?: boolean } | undefined)?.pendingMcpAuth === true;
};

export function ComposerContainer() {
    const ComposerShell = useSlot("ComposerShell");
    const aui = useAui();
    const text = useAuiState((s) => s.composer.text);
    const { isBusy, send, resetBusy } = useComposerBusyState();
    const mcpPending = useAuiState(threadHasPendingMcpAuth);
    const { pending: toolResponsesPending } = useTrueFoundryToolResponses();
    const cancel = useTrueFoundryCancel();
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (mcpPending) {
        return <McpAuthContainer />;
    }
    if (toolResponsesPending.length > 0) {
        return <AskUserContainer />;
    }

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void aui.composer().addAttachment(file);
                    event.target.value = "";
                }}
            />
            <ComposerShell
                attachments={<ComposerAttachmentsContainer />}
                value={text}
                placeholder="Ask anything... (Shift+Enter for new line)"
                disabled={isBusy}
                isRunning={isBusy}
                onValueChange={(value) => aui.composer().setText(value)}
                onSubmit={() => send(() => aui.composer().send())}
                onCancel={() => {
                    resetBusy();
                    void cancel();
                }}
                onAttach={() => fileInputRef.current?.click()}
            />
        </>
    );
}
