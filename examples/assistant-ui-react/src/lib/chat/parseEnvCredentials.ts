export type GatewayCredentials = {
    apiKey: string;
    gatewayUrl: string;
};

function unquote(value: string): string {
    const trimmed = value.trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function parseEnvLine(line: string): [string, string] | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
        return null;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
        return null;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = unquote(trimmed.slice(eq + 1));
    return [key, value];
}

export function parseEnvCredentials(text: string): GatewayCredentials {
    let apiKey: string | undefined;
    let gatewayUrl: string | undefined;

    for (const line of text.split(/\r?\n/)) {
        const parsed = parseEnvLine(line);
        if (parsed == null) {
            continue;
        }
        const [key, value] = parsed;
        if (key === "TFY_API_KEY") {
            apiKey = value;
        } else if (key === "TFY_GATEWAY_URL") {
            gatewayUrl = value;
        }
    }

    if (!apiKey) {
        throw new Error("Missing TFY_API_KEY in pasted .env content.");
    }
    if (!gatewayUrl) {
        throw new Error("Missing TFY_GATEWAY_URL in pasted .env content.");
    }

    return { apiKey, gatewayUrl };
}
