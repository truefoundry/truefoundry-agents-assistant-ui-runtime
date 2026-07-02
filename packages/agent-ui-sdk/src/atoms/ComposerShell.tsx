import type { ReactNode } from "react";
import { ArrowUpIcon, PlusIcon } from "lucide-react";

import { cn } from "./lib/cn.js";
import { IconButton } from "./primitives/IconButton.js";

export type ComposerShellProps = {
    value: string;
    placeholder: string;
    disabled: boolean;
    modelLabel?: string;
    modelIcon?: ReactNode;
    connectorStatusLabel?: string;
    onValueChange: (value: string) => void;
    onSubmit: () => void;
    onAttach?: () => void;
    className?: string;
};

export function ComposerShell({
    value,
    placeholder,
    disabled,
    modelLabel,
    modelIcon,
    connectorStatusLabel,
    onValueChange,
    onSubmit,
    onAttach,
    className,
}: ComposerShellProps) {
    return (
        <div
            data-slot="aui_composer-shell"
            className={cn(
                "border-border/60 flex w-full flex-col gap-2 rounded-(--composer-radius,1.5rem) border bg-(--composer-bg,var(--muted)) p-(--composer-padding,8px) shadow-sm",
                className,
            )}
        >
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
                className="placeholder:text-muted-foreground/80 max-h-32 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base outline-none"
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
                    <IconButton
                        tooltip="Send message"
                        variant="default"
                        disabled={disabled || value.trim().length === 0}
                        onClick={onSubmit}
                    >
                        <ArrowUpIcon />
                    </IconButton>
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
