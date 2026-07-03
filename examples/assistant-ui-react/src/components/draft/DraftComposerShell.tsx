"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const composerShellClassName = cn(
    "flex w-full flex-col gap-3 rounded-2xl border border-[#cee0f8] bg-white p-3",
);

type DraftComposerShellProps = {
    value: string;
    placeholder: string;
    disabled: boolean;
    attachments?: ReactNode;
    attachControl?: ReactNode;
    toolbarEnd?: ReactNode;
    onValueChange: (value: string) => void;
    onSubmit: () => void;
};

export function DraftComposerShell({
    value,
    placeholder,
    disabled,
    attachments,
    attachControl,
    toolbarEnd,
    onValueChange,
    onSubmit,
}: DraftComposerShellProps) {
    return (
        <div className="flex w-full flex-col gap-2">
            <div data-slot="aui_draft-composer-shell" className={composerShellClassName}>
                {attachments}
                <textarea
                    value={value}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={2}
                    aria-label="Message input"
                    onChange={(event) => onValueChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            onSubmit();
                        }
                    }}
                    className={cn(
                        "aui-composer-input max-h-32 min-h-5 w-full resize-none bg-transparent text-base leading-5 outline-none",
                        "placeholder:text-[#6f8ebd]",
                    )}
                />
                <div className="aui-composer-action-wrapper flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center">{attachControl}</div>
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                        {toolbarEnd}
                    </div>
                </div>
            </div>
        </div>
    );
}
