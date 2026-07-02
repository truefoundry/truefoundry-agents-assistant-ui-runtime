"use client";

import { useTrueFoundryMcpAuth } from "truefoundry-agents-assistant-ui-runtime";
import { useThreadIsRunning } from "@assistant-ui/core/react";

import { useSlot } from "../theme/SlotsProvider.js";

export function McpAuthContainer() {
    const McpAuthPrompt = useSlot("McpAuthPrompt");
    const { pending, resume } = useTrueFoundryMcpAuth();
    const isRunning = useThreadIsRunning();

    if (!pending) return null;

    return (
        <McpAuthPrompt
            servers={pending.mcpServers}
            disabled={isRunning}
            onContinue={() => void resume()}
        />
    );
}
