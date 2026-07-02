"use client";

import { useState } from "react";
import { useTrueFoundryToolResponses } from "truefoundry-agents-assistant-ui-runtime";
import { useThreadIsRunning } from "@assistant-ui/core/react";

import { useSlot } from "../theme/SlotsProvider.js";
import type { AskUserOption } from "../atoms/AskUserPrompt.js";

const OTHER_OPTION_ID = "__other";

export function AskUserContainer() {
    const AskUserPrompt = useSlot("AskUserPrompt");
    const { pending, respond } = useTrueFoundryToolResponses();
    const isRunning = useThreadIsRunning();
    const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(undefined);
    const [otherValue, setOtherValue] = useState("");

    const item = pending[0];
    if (item == null) return null;

    const options: AskUserOption[] = (item.options ?? []).map((option) => ({ id: option, label: option }));
    const allowOther = options.length === 0;

    const onSubmit = () => {
        const content =
            selectedOptionId != null && selectedOptionId !== OTHER_OPTION_ID
                ? (options.find((o) => o.id === selectedOptionId)?.label ?? "")
                : otherValue.trim();
        if (!content) return;
        respond({ toolCallId: item.toolCallId, content });
        setSelectedOptionId(undefined);
        setOtherValue("");
    };

    return (
        <AskUserPrompt
            question={item.question ?? "Answer required"}
            options={options}
            allowOther={allowOther}
            selectedOptionId={selectedOptionId}
            otherValue={otherValue}
            disabled={isRunning}
            onSelectOption={setSelectedOptionId}
            onOtherValueChange={setOtherValue}
            onSubmit={onSubmit}
        />
    );
}
