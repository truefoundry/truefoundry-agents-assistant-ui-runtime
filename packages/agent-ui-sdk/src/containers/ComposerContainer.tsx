"use client";

import { useRef } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { useThreadIsRunning } from "@assistant-ui/core/react";
import { useTrueFoundryToolResponses } from "truefoundry-agents-assistant-ui-runtime";

import { useSlot } from "../theme/SlotsProvider.js";
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (mcpPending) {
        return <McpAuthContainer />;
    }
    if (toolResponsesPending.length > 0) {
        return <AskUserContainer />;
    }

    return (
        <>
            {/*
             * ComposerShell's contract (Section 6) has no attachment-tray slot, so
             * staged attachments aren't shown visually here -- they're still
             * forwarded to the gateway via addAttachment(). Consumers wanting a
             * visible tray should compose ComposerAttachmentsContainer /
             * ComposerAttachmentPickerContainer directly instead of ComposerShell.
             */}
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
                value={text}
                placeholder="Ask anything... (Shift+Enter for new line)"
                disabled={isRunning}
                onValueChange={(value) => aui.composer().setText(value)}
                onSubmit={() => aui.composer().send()}
                onAttach={() => fileInputRef.current?.click()}
            />
        </>
    );
}
