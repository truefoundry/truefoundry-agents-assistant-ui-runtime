"use client";

import { ActionBarPrimitive, useAui, useAuiState } from "@assistant-ui/react";
import { useActionBarCopy } from "@assistant-ui/core/react";
import { CheckIcon, CopyIcon, PencilIcon, RotateCcwIcon } from "lucide-react";
import { trueFoundryExtras } from "truefoundry-agents-assistant-ui-runtime";

import { useSlot } from "../theme/SlotsProvider.js";
import { cn } from "./lib/cn.js";

function parseTurnIdFromMessageId(messageId: string): string {
    return messageId.replace(/-user$/, "");
}

export type UserMessageActionBarProps = {
    className?: string;
};

export function UserMessageActionBar({ className }: UserMessageActionBarProps) {
    const IconButton = useSlot("IconButton");
    const aui = useAui();
    const messageId = useAuiState((s) => s.message.id);
    const turnId = parseTurnIdFromMessageId(messageId);
    const { isCopied } = useActionBarCopy();

    return (
        <ActionBarPrimitive.Root
            hideWhenRunning
            className={cn(
                "aui-user-action-bar-root text-muted-foreground animate-in fade-in flex gap-1 duration-200",
                className,
            )}
        >    
            <ActionBarPrimitive.Edit asChild>
                <IconButton tooltip="Edit">
                    <PencilIcon />
                </IconButton>
            </ActionBarPrimitive.Edit>
            <IconButton
                tooltip="Reset"
                onClick={() => void trueFoundryExtras.get(aui).resetFromTurn(turnId)}
            >
                <RotateCcwIcon />
            </IconButton>
            <ActionBarPrimitive.Copy asChild>
                <IconButton tooltip="Copy">
                    {isCopied ? (
                        <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />
                    ) : (
                        <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />
                    )}
                </IconButton>
            </ActionBarPrimitive.Copy>
        </ActionBarPrimitive.Root>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        UserMessageActionBar: typeof UserMessageActionBar;
    }
}
