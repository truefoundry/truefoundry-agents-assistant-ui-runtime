"use client";

import { useAui, useAuiState } from "@assistant-ui/react";
import {
    AskUserContainer,
    ComposerAttachmentsContainer,
    McpAuthContainer,
    useComposerBusyState,
} from "@truefoundry/agent-ui-sdk";
import { useCallback, useRef } from "react";
import {
    mergeAgentSpec,
    useTrueFoundryAgentSpec,
    useTrueFoundryCancel,
    useTrueFoundryToolResponses,
    type AgentSpecUpdate,
} from "truefoundry-agents-assistant-ui-runtime";

import { DraftComposerAttachBar } from "@/components/draft/DraftComposerAttachBar";
import { DraftComposerCatalogProvider } from "@/components/draft/DraftComposerCatalog";
import { DraftComposerShell } from "@/components/draft/DraftComposerShell";
import {
    DraftReasoningSelector,
    DraftSendButton,
} from "@/components/draft/DraftComposerToolbar";
import { DraftModelSelector } from "@/components/draft/DraftModelSelector";
import { setStoredModelPreference } from "@/lib/draft/modelPreference";

const threadHasPendingMcpAuth = (s: {
    thread: {
        messages: readonly {
            role: string;
            status?: { type: string };
            metadata?: { custom?: unknown };
        }[];
    };
}) => {
    const messages = s.thread.messages;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant") return false;
    if (last.status?.type !== "requires-action") return false;
    return (last.metadata?.custom as { pendingMcpAuth?: boolean } | undefined)
        ?.pendingMcpAuth === true;
};

export function DraftComposerContainer() {
    const aui = useAui();
    const text = useAuiState((s) => s.composer.text);
    const { isBusy, send, resetBusy } = useComposerBusyState();
    const mcpPending = useAuiState(threadHasPendingMcpAuth);
    const { pending: toolResponsesPending } = useTrueFoundryToolResponses();
    const { agentSpec, isSpecSyncing, updateAgentSpec } = useTrueFoundryAgentSpec();
    const cancel = useTrueFoundryCancel();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePickFile = useCallback(() => {
        const input = fileInputRef.current;
        if (input == null) return;
        input.accept = "";
        input.click();
    }, []);

    const handleModelChange = useCallback(
        (model: NonNullable<AgentSpecUpdate["model"]>) => {
            updateAgentSpec({ model });
            if (agentSpec != null) {
                setStoredModelPreference(mergeAgentSpec(agentSpec, { model }).model);
            }
        },
        [agentSpec, updateAgentSpec],
    );

    if (mcpPending) {
        return <McpAuthContainer />;
    }
    if (toolResponsesPending.length > 0) {
        return <AskUserContainer />;
    }

    const disabled = isBusy;
    const spec = agentSpec;

    const handleSend = () => {
        send(() => aui.composer().send());
    };

    const handleCancel = () => {
        resetBusy();
        void cancel();
    };

    return (
        <DraftComposerCatalogProvider>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                    const files = event.target.files;
                    if (files == null) return;
                    for (const file of files) {
                        void aui.composer().addAttachment(file);
                    }
                    event.target.value = "";
                }}
            />
            <DraftComposerShell
                value={text}
                placeholder="Ask anything or describe the task you want to accomplish..."
                disabled={disabled}
                attachments={<ComposerAttachmentsContainer />}
                attachControl={
                    spec == null ? null : (
                        <DraftComposerAttachBar
                            disabled={disabled}
                            mcpServers={spec.mcpServers ?? []}
                            skills={spec.skills ?? []}
                            onMcpServersChange={(mcpServers) =>
                                updateAgentSpec({ mcpServers })
                            }
                            onSkillsChange={(skills) => updateAgentSpec({ skills })}
                            onPickFile={handlePickFile}
                        />
                    )
                }
                toolbarEnd={
                    spec == null ? null : (
                        <>
                            <DraftModelSelector
                                model={spec.model}
                                disabled={disabled}
                                onChange={handleModelChange}
                            />
                            <DraftReasoningSelector
                                model={spec.model}
                                disabled={disabled}
                                onChange={handleModelChange}
                            />
                            <DraftSendButton
                                disabled={isBusy ? false : disabled || text.trim().length === 0}
                                isRunning={isBusy}
                                onClick={() => (isBusy ? handleCancel() : handleSend())}
                            />
                        </>
                    )
                }
                onValueChange={(value) => aui.composer().setText(value)}
                onSubmit={handleSend}
            />
        </DraftComposerCatalogProvider>
    );
}
