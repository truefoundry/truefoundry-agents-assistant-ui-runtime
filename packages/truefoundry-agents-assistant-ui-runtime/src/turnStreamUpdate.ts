import type { MessageStatus } from "@assistant-ui/core";

import type { AssistantContentPart } from "./modelMessageContent.js";

export type TurnStreamUpdate = {
    content: AssistantContentPart[];
    status?: MessageStatus;
    metadata?: {
        custom?: Record<string, unknown>;
    };
};
