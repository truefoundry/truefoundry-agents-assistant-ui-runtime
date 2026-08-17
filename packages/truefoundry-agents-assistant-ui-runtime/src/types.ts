import type {
    AttachmentAdapter,
    DictationAdapter,
    ExternalStoreSharedOptions,
    FeedbackAdapter,
    RealtimeVoiceAdapter,
    SpeechSynthesisAdapter,
} from "@assistant-ui/core";

import type { AgentChatServer, AgentSpec } from "./server/types.js";

export type NamedAgentConfig = {
    mode: "named";
    agentName: string;
};

export type DraftAgentConfig = {
    mode: "draft";
    defaultAgentSpec: AgentSpec;
    onAgentSpecChange?: ((spec: AgentSpec) => void) | undefined;
};

export type AgentConfig = NamedAgentConfig | DraftAgentConfig;

type AgentRuntimeBaseOptions = ExternalStoreSharedOptions & {
    server: AgentChatServer;
    initialSessionId?: string | undefined;
    threadId?: string | undefined;
    onThreadIdChange?: ((threadId: string | undefined) => void) | undefined;
    onError?: ((error: unknown) => void) | undefined;
    /**
     * Optional filter forwarded to `listSessions({ agentId })`.
     * Omit for all chats; hosts that key agents by name pass that name as the id.
     */
    listSessionsAgentId?: string | undefined;
    adapters?:
        | {
              attachments?: AttachmentAdapter | undefined;
              speech?: SpeechSynthesisAdapter | undefined;
              dictation?: DictationAdapter | undefined;
              voice?: RealtimeVoiceAdapter | undefined;
              feedback?: FeedbackAdapter | undefined;
          }
        | undefined;
};

export type UseAgentRuntimeOptions = AgentRuntimeBaseOptions & {
    /** Discriminated agent source. Omit when using legacy `agentName`. */
    agent?: AgentConfig | undefined;
    /** Legacy named-agent shorthand. Prefer `agent: { mode: "named", agentName }`. */
    agentName?: string | undefined;
};

export type ResolvedAgentRuntimeOptions = AgentRuntimeBaseOptions & {
    agent: AgentConfig;
};

export function resolveAgentConfig(
    options: Pick<UseAgentRuntimeOptions, "agent" | "agentName">,
): AgentConfig {
    if (options.agent != null) {
        if (options.agent.mode === "named" && options.agentName != null) {
            return { mode: "named", agentName: options.agentName };
        }
        return options.agent;
    }
    if (options.agentName != null) {
        return { mode: "named", agentName: options.agentName };
    }
    throw new Error(
        "useAgentRuntime requires `agent` or legacy `agentName`.",
    );
}

export function resolveAgentRuntimeOptions(
    options: UseAgentRuntimeOptions,
): ResolvedAgentRuntimeOptions {
    const agent = resolveAgentConfig(options);

    return {
        ...options,
        agent,
    };
}
