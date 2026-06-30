"use client";

import {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from "react";

import { parseEnvCredentials } from "@/lib/chat/parseEnvCredentials";
import type { GatewayCredentials } from "@/lib/chat/parseEnvCredentials";

export type { GatewayCredentials };

const GatewayCredentialsContext = createContext<GatewayCredentials | null>(null);

export function GatewayCredentialsProvider({ children }: { children: ReactNode }) {
    const [credentials, setCredentials] = useState<GatewayCredentials | null>(null);

    if (credentials == null) {
        return <ConnectGateway onConnect={setCredentials} />;
    }

    return (
        <GatewayCredentialsContext.Provider value={credentials}>
            {children}
        </GatewayCredentialsContext.Provider>
    );
}

export function useGatewayCredentials(): GatewayCredentials {
    const credentials = useContext(GatewayCredentialsContext);
    if (credentials == null) {
        throw new Error("Gateway credentials are not configured.");
    }
    return credentials;
}

function ConnectGateway({
    onConnect,
}: {
    onConnect: (credentials: GatewayCredentials) => void;
}) {
    const [envText, setEnvText] = useState("");
    const [error, setError] = useState<string | null>(null);

    function handleConnect() {
        try {
            setError(null);
            onConnect(parseEnvCredentials(envText));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Invalid .env content.");
        }
    }

    return (
        <main className="flex h-dvh flex-col items-center justify-center gap-6 p-8">
            <div className="w-full max-w-lg space-y-4">
                <h1 className="text-xl font-semibold">Connect to TrueFoundry Gateway</h1>
                <p className="text-sm text-muted-foreground">
                    Paste your <code className="text-xs">.env</code> content (
                    <code className="text-xs">TFY_API_KEY</code> and{" "}
                    <code className="text-xs">TFY_GATEWAY_URL</code>).
                </p>
                <label className="block space-y-1">
                    <span className="text-sm text-muted-foreground">.env</span>
                    <textarea
                        value={envText}
                        onChange={(e) => {
                            setEnvText(e.target.value);
                            setError(null);
                        }}
                        placeholder={"TFY_API_KEY=your-api-key\nTFY_GATEWAY_URL=https://gateway.truefoundry.ai/<tenant>"}
                        rows={6}
                        spellCheck={false}
                        className="w-full rounded-md border px-3 py-2 font-mono text-sm"
                    />
                </label>
                {error != null && (
                    <p className="text-sm text-red-600">{error}</p>
                )}
                <button
                    type="button"
                    disabled={!envText.trim()}
                    onClick={handleConnect}
                    className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
                >
                    Connect
                </button>
            </div>
        </main>
    );
}
