import type {
    AttachmentAdapter,
    DictationAdapter,
    ExternalStoreSharedOptions,
    FeedbackAdapter,
    RealtimeVoiceAdapter,
    SpeechSynthesisAdapter,
} from "@assistant-ui/core";
import type { AgentSessionClient } from "truefoundry-gateway-sdk/agents";
import type { TrueFoundryGateway } from "truefoundry-gateway-sdk";

import type { AgentSpec } from "./private/agentSpec.js";

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
    client: AgentSessionClient;
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
    /** Required when `agent.mode === "draft"`. */
    gateway?: TrueFoundryGateway | undefined;
};

export type ResolvedTrueFoundryAgentRuntimeOptions = TrueFoundryAgentRuntimeBaseOptions & {
    agent: TrueFoundryAgentConfig;
    gateway?: TrueFoundryGateway | undefined;
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

    if (agent.mode === "draft" && options.gateway == null) {
        throw new Error(
            "Draft agent mode requires a `gateway` TrueFoundryGateway client.",
        );
    }

    return {
        ...options,
        agent,
        gateway: options.gateway,
    };
}
