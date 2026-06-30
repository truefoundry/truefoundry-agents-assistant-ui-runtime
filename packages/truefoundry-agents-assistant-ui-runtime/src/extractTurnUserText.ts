import type { Turn } from "truefoundry-gateway-sdk/agents";

export function extractTurnUserText(input: Turn["input"]): string {
    const parts: string[] = [];
    for (const item of input ?? []) {
        if (item.type !== "user.message") {
            continue;
        }
        const { content } = item;
        if (typeof content === "string") {
            parts.push(content);
            continue;
        }
        for (const part of content) {
            if (part.type === "text") {
                parts.push(part.text);
            }
        }
    }
    return parts.join("\n").trim();
}
