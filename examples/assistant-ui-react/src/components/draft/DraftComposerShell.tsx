"use client";

import type { ReactNode } from "react";

import { draftInputClassName, draftShellClassName } from "@/components/draft/draftComposerStyles";

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
            <div data-slot="aui_draft-composer-shell" className={draftShellClassName}>
                {attachments}
                <textarea
                    value={value}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={3}
                    aria-label="Message input"
                    onChange={(event) => onValueChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            onSubmit();
                        }
                    }}
                    className={draftInputClassName}
                />
                <div className="aui-composer-action-wrapper relative flex items-center justify-between gap-2">
                    <div className="relative flex min-w-0 flex-1 items-center">{attachControl}</div>
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                        {toolbarEnd}
                    </div>
                </div>
            </div>
        </div>
    );
}
