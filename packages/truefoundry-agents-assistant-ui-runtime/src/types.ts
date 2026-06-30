import type {
    AttachmentAdapter,
    DictationAdapter,
    ExternalStoreSharedOptions,
    FeedbackAdapter,
    RealtimeVoiceAdapter,
    SpeechSynthesisAdapter,
} from "@assistant-ui/core";
import type { AgentSessionClient } from "truefoundry-gateway-sdk/agents";

export type UseTrueFoundryAgentRuntimeOptions = ExternalStoreSharedOptions & {
    client: AgentSessionClient;
    agentName: string;
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
