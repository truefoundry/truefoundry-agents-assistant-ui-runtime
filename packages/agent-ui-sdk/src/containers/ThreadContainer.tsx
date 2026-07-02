"use client";

import type { ReactNode } from "react";
import { ThreadPrimitive, useAuiState, type AssistantState } from "@assistant-ui/react";

import { useSlot } from "../theme/SlotsProvider.js";
import { AssistantMessageContainer } from "./AssistantMessageContainer.js";
import { UserEditComposerContainer } from "./UserEditComposerContainer.js";
import { UserMessageContainer } from "./UserMessageContainer.js";

// Startup exposes a loading placeholder thread; treat it as a new chat so the
// composer mounts centered. Loads after startup keep the docked layout.
const isNewChatView = (s: AssistantState) =>
    s.thread.messages.length === 0 && (!s.thread.isLoading || s.threads.isLoading);

function ThreadMessage({ isEditing }: { isEditing: boolean }) {
    const role = useAuiState((s) => s.message.role);
    if (role === "user") {
        if (isEditing) {
            return <UserEditComposerContainer />;
        }
        return <UserMessageContainer />;
    }
    return <AssistantMessageContainer />;
}

export type ThreadContainerProps = {
    /**
     * Rendered in the bottom composer area. Left undefined until
     * `ComposerContainer` exists (milestone 6); the public `<Thread/>` export
     * wires the two together once it does.
     */
    composer?: ReactNode;
};

export function ThreadContainer({ composer }: ThreadContainerProps) {
    const ThreadRootShell = useSlot("ThreadRootShell");
    const ThreadViewportShell = useSlot("ThreadViewportShell");
    const ThreadComposerAreaShell = useSlot("ThreadComposerAreaShell");
    const MessageGroup = useSlot("MessageGroup");
    const WelcomeScreen = useSlot("WelcomeScreen");
    const MessageListSkeleton = useSlot("MessageListSkeleton");
    const ScrollToBottomButton = useSlot("ScrollToBottomButton");

    const isEmpty = useAuiState(isNewChatView);
    const isLoading = useAuiState((s) => s.thread.isLoading);

    return (
        <ThreadPrimitive.Root asChild>
            <ThreadRootShell>
                <ThreadPrimitive.Viewport asChild turnAnchor="top">
                    <ThreadViewportShell isEmpty={isEmpty}>
                        {isEmpty && <WelcomeScreen />}
                        {isLoading ? (
                            <MessageListSkeleton />
                        ) : (
                            <MessageGroup>
                                <ThreadPrimitive.Messages>
                                    {({ message }) => (
                                        <ThreadMessage
                                            isEditing={
                                                message.role === "user" &&
                                                message.composer.isEditing
                                            }
                                        />
                                    )}
                                </ThreadPrimitive.Messages>
                            </MessageGroup>
                        )}
                    </ThreadViewportShell>
                </ThreadPrimitive.Viewport>

                {!isLoading && (
                    <ThreadComposerAreaShell isEmpty={isEmpty}>
                        <ThreadPrimitive.ScrollToBottom asChild>
                            <ScrollToBottomButton />
                        </ThreadPrimitive.ScrollToBottom>
                        {composer}
                    </ThreadComposerAreaShell>
                )}
            </ThreadRootShell>
        </ThreadPrimitive.Root>
    );
}
