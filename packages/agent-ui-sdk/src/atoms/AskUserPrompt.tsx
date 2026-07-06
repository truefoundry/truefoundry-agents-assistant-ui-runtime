import { cn } from "./lib/cn.js";
import { Button } from "./primitives/Button.js";

export type AskUserOption = { id: string; label: string };

const OTHER_OPTION_ID = "__other";

export type AskUserPromptProps = {
    question: string;
    options: AskUserOption[];
    allowOther: boolean;
    selectedOptionId?: string;
    otherValue: string;
    disabled: boolean;
    onSelectOption: (optionId: string) => void;
    onOtherValueChange: (value: string) => void;
    onSubmit: () => void;
    className?: string;
};

export function AskUserPrompt({
    question,
    options,
    allowOther,
    selectedOptionId,
    otherValue,
    disabled,
    onSelectOption,
    onOtherValueChange,
    onSubmit,
    className,
}: AskUserPromptProps) {
    const canSubmit = selectedOptionId != null && selectedOptionId !== OTHER_OPTION_ID
        ? true
        : selectedOptionId === OTHER_OPTION_ID && otherValue.trim().length > 0;

    return (
        <div
            data-slot="aui_ask-user-prompt"
            className={cn(
                "border-border/60 flex w-full flex-col gap-3 rounded-[var(--composer-radius,1.5rem)] border bg-[var(--composer-bg,var(--muted))] p-[var(--composer-padding,8px)]",
                className,
            )}
        >
            <p className="text-foreground px-2.5 text-sm font-medium">{question}</p>
            <div className="flex flex-col gap-1.5 px-2.5">
                {options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm">
                        <input
                            type="radio"
                            name="ask-user-option"
                            checked={selectedOptionId === option.id}
                            disabled={disabled}
                            onChange={() => onSelectOption(option.id)}
                        />
                        {option.label}
                    </label>
                ))}
                {allowOther && (
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="radio"
                            name="ask-user-option"
                            checked={selectedOptionId === OTHER_OPTION_ID}
                            disabled={disabled}
                            onChange={() => onSelectOption(OTHER_OPTION_ID)}
                        />
                        <input
                            type="text"
                            value={otherValue}
                            placeholder="Type your answer..."
                            disabled={disabled}
                            onFocus={() => onSelectOption(OTHER_OPTION_ID)}
                            onChange={(event) => {
                                onSelectOption(OTHER_OPTION_ID);
                                onOtherValueChange(event.target.value);
                            }}
                            aria-label="Other answer"
                            className="border-border/60 flex-1 rounded-md border bg-transparent px-2 py-1 text-sm outline-none"
                        />
                    </label>
                )}
            </div>
            <div className="flex justify-end px-2.5">
                <Button
                    type="button"
                    className="rounded-full px-4"
                    disabled={disabled || !canSubmit}
                    onClick={onSubmit}
                >
                    Submit
                </Button>
            </div>
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        AskUserPrompt: typeof AskUserPrompt;
    }
}
