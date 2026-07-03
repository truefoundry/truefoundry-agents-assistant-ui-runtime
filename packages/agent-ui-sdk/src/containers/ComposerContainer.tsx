"use client";

import { useRef } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { useThreadIsRunning } from "@assistant-ui/core/react";
import { useTrueFoundryCancel, useTrueFoundryToolResponses } from "truefoundry-agents-assistant-ui-runtime";

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
    const isRunning = useThreadIsRunning();
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
                disabled={isRunning}
                isRunning={isRunning}
                onValueChange={(value) => aui.composer().setText(value)}
                onSubmit={() => aui.composer().send()}
                onCancel={() => void cancel()}
                onAttach={() => fileInputRef.current?.click()}
            />
        </>
    );
}
