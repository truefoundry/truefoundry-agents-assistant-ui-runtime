import type { ReactNode } from "react";
import { ArrowUpIcon, LoaderIcon, PlusIcon } from "lucide-react";

import { cn } from "./lib/cn.js";
import { Button } from "./primitives/Button.js";
import { IconButton } from "./primitives/IconButton.js";

export type ComposerShellProps = {
    value: string;
    placeholder: string;
    disabled: boolean;
    isRunning?: boolean;
    attachments?: ReactNode;
    modelLabel?: string;
    modelIcon?: ReactNode;
    connectorStatusLabel?: string;
    onValueChange: (value: string) => void;
    onSubmit: () => void;
    onCancel?: () => void;
    onAttach?: () => void;
    className?: string;
};

export function ComposerShell({
    value,
    placeholder,
    disabled,
    isRunning = false,
    attachments,
    modelLabel,
    modelIcon,
    connectorStatusLabel,
    onValueChange,
    onSubmit,
    onCancel,
    onAttach,
    className,
}: ComposerShellProps) {
    return (
        <div
            data-slot="aui_composer-shell"
            className={cn(
                "border-border/60 focus-within:border-ring focus-within:ring-ring/20 flex w-full flex-col gap-2 rounded-[var(--composer-radius,1.5rem)] border bg-[var(--composer-bg,var(--muted))] p-[var(--composer-padding,8px)] shadow-sm transition-colors focus-within:ring-3",
                className,
            )}
        >
            {attachments}
            <textarea
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
                aria-label="Message input"
                onChange={(event) => onValueChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        onSubmit();
                    }
                }}
                className="placeholder:text-muted-foreground/80 max-h-32 min-h-10 w-full resize-none rounded-lg bg-transparent px-2.5 py-1 text-base outline-none"
            />
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    {onAttach && (
                        <IconButton tooltip="Attach" onClick={onAttach}>
                            <PlusIcon />
                        </IconButton>
                    )}
                    {connectorStatusLabel && (
                        <span className="text-muted-foreground text-xs">{connectorStatusLabel}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {modelLabel && (
                        <span className="bg-muted text-muted-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                            {modelIcon}
                            {modelLabel}
                        </span>
                    )}
                    {isRunning ? (
                        <Button
                            variant="default"
                            size="sm"
                            className="gap-1.5 rounded-full"
                            disabled={!onCancel}
                            onClick={onCancel}
                        >
                            <LoaderIcon className="size-3.5 animate-spin [animation-duration:0.6s]" />
                            Cancel
                        </Button>
                    ) : (
                        <IconButton
                            tooltip="Send message"
                            variant="default"
                            disabled={disabled || value.trim().length === 0}
                            onClick={onSubmit}
                        >
                            <ArrowUpIcon />
                        </IconButton>
                    )}
                </div>
            </div>
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        ComposerShell: typeof ComposerShell;
    }
}
