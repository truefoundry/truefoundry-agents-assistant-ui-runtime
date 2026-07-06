"use client";

import { groupPartByType, MessagePrimitive, useAui, type EnrichedPartState } from "@assistant-ui/react";
import {
    useActionBarCopy,
    useMessageBranching,
    useMessageError,
    useThreadIsRunning,
} from "@assistant-ui/core/react";

import { useSlot } from "../theme/SlotsProvider.js";
import { AssistantTextContainer } from "./AssistantTextContainer.js";
import { MessageImageContainer } from "./MessageImageContainer.js";
import { ReasoningContainer } from "./ReasoningContainer.js";
import { ToolCallContainer } from "./ToolCallContainer.js";
import { ToolGroupContainer, type ThreadGroupPart } from "./ToolGroupContainer.js";

/**
 * Dispatches a leaf message part to its renderer. "data" parts (generative
 * UI) are out of scope for this SDK entirely.
 */
function AssistantLeafPartContainer({ part }: { part: EnrichedPartState }) {
    switch (part.type) {
        case "text":
        case "reasoning":
            return <AssistantTextContainer />;
        case "image":
            return <MessageImageContainer />;
        case "tool-call":
            return <ToolCallContainer {...part} />;
        default:
            return null;
    }
}

function downloadMarkdown(text: string) {
    if (typeof document === "undefined") return;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "message.md";
    anchor.click();
    URL.revokeObjectURL(url);
}

export function AssistantMessageContainer() {
    const MessageBubble = useSlot("MessageBubble");
    const MessageIndicator = useSlot("MessageIndicator");
    const MessageErrorBanner = useSlot("MessageErrorBanner");
    const MessageActionBar = useSlot("MessageActionBar");
    const BranchIndicator = useSlot("BranchIndicator");

    const aui = useAui();
    const isRunning = useThreadIsRunning();
    const error = useMessageError();
    const { copy, isCopied } = useActionBarCopy({
        copyToClipboard: (text) => navigator.clipboard.writeText(text),
    });
    const { branchNumber, branchCount, goToPrev, goToNext } = useMessageBranching();

    return (
        <MessagePrimitive.Root data-role="assistant">
            <MessageBubble
                variant="assistant"
                error={error !== undefined ? <MessageErrorBanner message={String(error)} /> : undefined}
                branchIndicator={
                    <BranchIndicator
                        index={branchNumber}
                        count={branchCount}
                        onPrevious={goToPrev}
                        onNext={goToNext}
                    />
                }
                actionBar={
                    !isRunning ? (
                        <MessageActionBar
                            isCopied={isCopied}
                            onCopy={copy}
                            onExportMarkdown={() => downloadMarkdown(aui.message().getCopyText())}
                        />
                    ) : undefined
                }
            >
                <MessagePrimitive.GroupedParts
                    groupBy={groupPartByType({
                        reasoning: ["group-chainOfThought", "group-reasoning"],
                        "tool-call": ["group-chainOfThought", "group-tool"],
                        "standalone-tool-call": [],
                    })}
                >
                    {({ part, children }) => {
                        switch (part.type) {
                            case "group-chainOfThought":
                                return (
                                    <div data-slot="aui_chain-of-thought" className="flex flex-col gap-3">
                                        {children}
                                    </div>
                                );
                            case "group-tool":
                                return (
                                    <ToolGroupContainer group={part as ThreadGroupPart}>
                                        {children}
                                    </ToolGroupContainer>
                                );
                            case "group-reasoning":
                                return (
                                    <ReasoningContainer group={part as ThreadGroupPart}>
                                        {children}
                                    </ReasoningContainer>
                                );
                            case "text":
                            case "reasoning":
                            case "tool-call":
                            case "image":
                            case "data":
                                return <AssistantLeafPartContainer part={part} />;
                            case "indicator":
                                return <MessageIndicator />;
                            default:
                                return null;
                        }
                    }}
                </MessagePrimitive.GroupedParts>
            </MessageBubble>
        </MessagePrimitive.Root>
    );
}
