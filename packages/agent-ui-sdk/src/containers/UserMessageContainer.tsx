"use client";

import { MessagePrimitive } from "@assistant-ui/react";
import { useMessageBranching, useThreadIsRunning } from "@assistant-ui/core/react";

import { useSlot } from "../theme/SlotsProvider.js";
import { MessageAttachmentsContainer } from "./AttachmentsContainer.js";
import { AssistantTextContainer } from "./AssistantTextContainer.js";

export function UserMessageContainer() {
    const MessageBubble = useSlot("MessageBubble");
    const UserMessageActionBar = useSlot("UserMessageActionBar");
    const BranchIndicator = useSlot("BranchIndicator");
    const isRunning = useThreadIsRunning();
    const { branchNumber, branchCount, goToPrev, goToNext } = useMessageBranching();

    return (
        <MessagePrimitive.Root data-role="user">
            <MessageBubble
                variant="user"
                attachments={<MessageAttachmentsContainer />}
                branchIndicator={
                    <BranchIndicator
                        index={branchNumber}
                        count={branchCount}
                        onPrevious={goToPrev}
                        onNext={goToNext}
                    />
                }
                actionBar={!isRunning ? <UserMessageActionBar /> : undefined}
            >
                <MessagePrimitive.Parts components={{ Text: AssistantTextContainer }} />
            </MessageBubble>
        </MessagePrimitive.Root>
    );
}
