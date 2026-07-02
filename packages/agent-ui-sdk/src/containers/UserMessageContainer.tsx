"use client";

import { MessagePrimitive } from "@assistant-ui/react";
import { useMessageBranching } from "@assistant-ui/core/react";

import { useSlot } from "../theme/SlotsProvider.js";
import { AssistantTextContainer } from "./AssistantTextContainer.js";

export function UserMessageContainer() {
    const MessageBubble = useSlot("MessageBubble");
    const BranchIndicator = useSlot("BranchIndicator");
    const { branchNumber, branchCount, goToPrev, goToNext } = useMessageBranching();

    return (
        <MessagePrimitive.Root data-role="user">
            <MessageBubble
                variant="user"
                branchIndicator={
                    <BranchIndicator
                        index={branchNumber}
                        count={branchCount}
                        onPrevious={goToPrev}
                        onNext={goToNext}
                    />
                }
            >
                <MessagePrimitive.Parts components={{ Text: AssistantTextContainer }} />
            </MessageBubble>
        </MessagePrimitive.Root>
    );
}
