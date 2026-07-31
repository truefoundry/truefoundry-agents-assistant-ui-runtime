import type {
    AttachmentAdapter,
    DictationAdapter,
    ExternalStoreSharedOptions,
    FeedbackAdapter,
    RealtimeVoiceAdapter,
    SpeechSynthesisAdapter,
} from "@assistant-ui/core";

import type { AgentSpec } from "./private/agentSpec.js";
import type { AgentChatServer } from "./server/types.js";

export type NamedAgentConfig = {
    mode: "named";
    agentName: string;
};

export type DraftAgentConfig = {
    mode: "draft";
    defaultAgentSpec: AgentSpec;
    onAgentSpecChange?: ((spec: AgentSpec) => void) | undefined;
};

export type TrueFoundryAgentConfig = NamedAgentConfig | DraftAgentConfig;

type TrueFoundryAgentRuntimeBaseOptions = ExternalStoreSharedOptions & {
    server: AgentChatServer;
    initialSessionId?: string | undefined;
    threadId?: string | undefined;
    onThreadIdChange?: ((threadId: string | undefined) => void) | undefined;
    onError?: ((error: unknown) => void) | undefined;
    listEventsConcurrency?: number | undefined;
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

export type UseTrueFoundryAgentRuntimeOptions = TrueFoundryAgentRuntimeBaseOptions & {
    /** Discriminated agent source. Omit when using legacy `agentName`. */
    agent?: TrueFoundryAgentConfig | undefined;
    /** Legacy named-agent shorthand. Prefer `agent: { mode: "named", agentName }`. */
    agentName?: string | undefined;
};

export type ResolvedTrueFoundryAgentRuntimeOptions = TrueFoundryAgentRuntimeBaseOptions & {
    agent: TrueFoundryAgentConfig;
};

export function resolveTrueFoundryAgentConfig(
    options: Pick<UseTrueFoundryAgentRuntimeOptions, "agent" | "agentName">,
): TrueFoundryAgentConfig {
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
        "useTrueFoundryAgentRuntime requires `agent` or legacy `agentName`.",
    );
}

export function resolveTrueFoundryAgentRuntimeOptions(
    options: UseTrueFoundryAgentRuntimeOptions,
): ResolvedTrueFoundryAgentRuntimeOptions {
    const agent = resolveTrueFoundryAgentConfig(options);

    return {
        ...options,
        agent,
    };
}
