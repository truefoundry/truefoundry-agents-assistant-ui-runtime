import { useState } from "react";

import { cn } from "./lib/cn.js";
import { Button } from "./primitives/Button.js";

export type ToolApprovalOption = {
    id: string;
    label: string;
    isAllow: boolean;
    grants?: readonly string[];
    confirm?: {
        title?: string;
        description?: string;
    };
};

export type ToolApprovalBarProps = {
    options: ToolApprovalOption[];
    onSelectOption: (optionId: string) => void;
    className?: string;
};

export function ToolApprovalBar({ options, onSelectOption, className }: ToolApprovalBarProps) {
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const confirming = confirmingId != null ? options.find((o) => o.id === confirmingId) : undefined;

    if (confirming) {
        return (
            <div className={cn("aui-tool-approval-confirm flex flex-col gap-2 pt-1", className)}>
                <p className="font-semibold">{confirming.confirm?.title ?? `${confirming.label}?`}</p>
                {confirming.confirm?.description && (
                    <p className="text-muted-foreground">{confirming.confirm.description}</p>
                )}
                {confirming.grants && confirming.grants.length > 0 && (
                    <ul className="flex flex-col gap-1">
                        {confirming.grants.map((grant) => (
                            <li key={grant}>
                                <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{grant}</code>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        className="active:scale-[0.98]"
                        onClick={() => {
                            onSelectOption(confirming.id);
                            setConfirmingId(null);
                        }}
                    >
                        Confirm
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="active:scale-[0.98]"
                        onClick={() => setConfirmingId(null)}
                    >
                        Back
                    </Button>
                </div>
            </div>
        );
    }

    const firstAllowId = options.find((o) => o.isAllow)?.id;

    return (
        <div className={cn("aui-tool-approval-bar flex flex-wrap items-center gap-2 pt-1", className)}>
            {options.map((option) => (
                <Button
                    key={option.id}
                    size="sm"
                    variant={option.id === firstAllowId ? "default" : "outline"}
                    className="active:scale-[0.98]"
                    onClick={() =>
                        option.confirm ? setConfirmingId(option.id) : onSelectOption(option.id)
                    }
                >
                    {option.label}
                </Button>
            ))}
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        ToolApprovalBar: typeof ToolApprovalBar;
    }
}
