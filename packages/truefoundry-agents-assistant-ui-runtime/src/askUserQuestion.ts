import type { ToolCall } from "truefoundry-gateway-sdk/agents";

export function isAskUserQuestionToolCall(
    toolCall: Pick<ToolCall, "toolInfo">,
): boolean {
    return (
        toolCall.toolInfo.type === "truefoundry-system" &&
        toolCall.toolInfo.name === "ask_user_question"
    );
}

export type AskUserQuestionArgs = {
    question?: string;
    options?: string[];
};

export function parseAskUserQuestionArgs(
    argsText: string | undefined,
): AskUserQuestionArgs {
    if (!argsText) {
        return {};
    }
    try {
        const parsed: unknown = JSON.parse(argsText);
        if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const record = parsed as Record<string, unknown>;
        const question = typeof record.question === "string" ? record.question : undefined;
        const options = Array.isArray(record.options)
            ? record.options.filter((item): item is string => typeof item === "string")
            : undefined;
        return { question, options };
    } catch {
        return {};
    }
}
