"use client";

import { useRef } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { useThreadIsRunning } from "@assistant-ui/core/react";
import {
    useTrueFoundryAgentSpec,
    useTrueFoundryToolResponses,
} from "truefoundry-agents-assistant-ui-runtime";
import {
    AskUserContainer,
    McpAuthContainer,
} from "@truefoundry/agent-ui-sdk";

import {
    InstructionsEditor,
    McpServersPanel,
    SkillsPanel,
} from "@/components/draft/DraftConfigPanels";
import { DraftComposerShell } from "@/components/draft/DraftComposerShell";
import { ModelPicker } from "@/components/draft/ModelPicker";
import { connectorStatusLabel } from "@/lib/draft/defaultAgentSpec";

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
    const isRunning = useThreadIsRunning();
    const mcpPending = useAuiState(threadHasPendingMcpAuth);
    const { pending: toolResponsesPending } = useTrueFoundryToolResponses();
    const { agentSpec, isSpecSyncing, updateAgentSpec } = useTrueFoundryAgentSpec();
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (mcpPending) {
        return <McpAuthContainer />;
    }
    if (toolResponsesPending.length > 0) {
        return <AskUserContainer />;
    }

    const disabled = isRunning || isSpecSyncing;
    const spec = agentSpec;

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
            <DraftComposerShell
                value={text}
                placeholder="Test your draft agent... (Shift+Enter for new line)"
                disabled={disabled}
                modelLabel={spec?.model.name}
                connectorStatusLabel={connectorStatusLabel(spec)}
                configPanels={
                    spec == null ? null : (
                        <>
                            <ModelPicker
                                model={spec.model}
                                disabled={disabled}
                                onChange={(model) => updateAgentSpec({ model })}
                            />
                            <InstructionsEditor
                                value={spec.instructions ?? ""}
                                disabled={disabled}
                                onChange={(instructions) =>
                                    updateAgentSpec({ instructions })
                                }
                            />
                            <McpServersPanel
                                mcpServers={spec.mcpServers ?? []}
                                disabled={disabled}
                                onChange={(mcpServers) =>
                                    updateAgentSpec({ mcpServers })
                                }
                            />
                            <SkillsPanel
                                skills={spec.skills ?? []}
                                disabled={disabled}
                                onChange={(skills) => updateAgentSpec({ skills })}
                            />
                        </>
                    )
                }
                onValueChange={(value) => aui.composer().setText(value)}
                onSubmit={() => aui.composer().send()}
                onAttach={() => fileInputRef.current?.click()}
            />
        </>
    );
}
