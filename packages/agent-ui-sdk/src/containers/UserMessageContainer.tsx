"use client";

import { MessagePrimitive } from "@assistant-ui/react";
import { useThreadIsRunning } from "@assistant-ui/core/react";

import { useSlot } from "../theme/SlotsProvider.js";
import { MessageAttachmentsContainer } from "./AttachmentsContainer.js";
import { AssistantTextContainer } from "./AssistantTextContainer.js";

export function UserMessageContainer() {
    const MessageBubble = useSlot("MessageBubble");
    const UserMessageActionBar = useSlot("UserMessageActionBar");
    const isRunning = useThreadIsRunning();

    return (
        <MessagePrimitive.Root data-role="user">
            <MessageBubble
                variant="user"
                attachments={<MessageAttachmentsContainer />}
                actionBar={!isRunning ? <UserMessageActionBar /> : undefined}
            >
                <MessagePrimitive.Parts components={{ Text: AssistantTextContainer }} />
            </MessageBubble>
        </MessagePrimitive.Root>
    );
}
