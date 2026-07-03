"use client";

import {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from "react";

import { useAuth } from "@/lib/auth/AuthProvider";

const GATEWAY_URL_STORAGE_KEY = "tf_gateway_url_v1";

export type GatewayCredentials = {
    apiKey: string;
    gatewayUrl: string;
    agentName?: string;
};

const GatewayCredentialsContext = createContext<GatewayCredentials | null>(null);

function readStoredGatewayUrl(): string {
    if (typeof window === "undefined") return "";
    return (
        window.localStorage.getItem(GATEWAY_URL_STORAGE_KEY) ??
        process.env.NEXT_PUBLIC_TF_GATEWAY_URL ??
        ""
    );
}

export function GatewayCredentialsProvider({ children }: { children: ReactNode }) {
    const { token } = useAuth();
    const [gatewayDetails, setGatewayDetails] = useState<{
        gatewayUrl: string;
        agentName?: string;
    } | null>(() => {
        const gatewayUrl = readStoredGatewayUrl();
        return gatewayUrl ? { gatewayUrl } : null;
    });

    if (gatewayDetails == null) {
        return <GatewayDetailsForm onSubmit={setGatewayDetails} />;
    }

    return (
        <GatewayCredentialsContext.Provider
            value={{ apiKey: token, ...gatewayDetails }}
        >
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

function GatewayDetailsForm({
    onSubmit,
}: {
    onSubmit: (details: { gatewayUrl: string; agentName?: string }) => void;
}) {
    const [gatewayUrl, setGatewayUrl] = useState(
        process.env.NEXT_PUBLIC_TF_GATEWAY_URL ?? "",
    );
    const [agentName, setAgentName] = useState(
        process.env.NEXT_PUBLIC_TF_AGENT_NAME ?? "",
    );
    const [error, setError] = useState<string | null>(null);

    function handleSubmit() {
        const trimmedUrl = gatewayUrl.trim();
        if (!trimmedUrl) {
            setError("Gateway URL is required.");
            return;
        }
        window.localStorage.setItem(GATEWAY_URL_STORAGE_KEY, trimmedUrl);
        onSubmit({
            gatewayUrl: trimmedUrl,
            agentName: agentName.trim() || undefined,
        });
    }

    return (
        <main className="flex h-dvh flex-col items-center justify-center gap-6 p-8">
            <div className="w-full max-w-lg space-y-4">
                <h1 className="text-xl font-semibold">Gateway settings</h1>
                <p className="text-sm text-muted-foreground">
                    Enter the TrueFoundry gateway URL for your tenant.
                </p>
                <label className="block space-y-1">
                    <span className="text-sm text-muted-foreground">Gateway URL</span>
                    <input
                        value={gatewayUrl}
                        onChange={(e) => {
                            setGatewayUrl(e.target.value);
                            setError(null);
                        }}
                        placeholder="https://gateway.truefoundry.ai/<tenant>"
                        spellCheck={false}
                        className="w-full rounded-md border px-3 py-2 font-mono text-sm"
                    />
                </label>
                <label className="block space-y-1">
                    <span className="text-sm text-muted-foreground">
                        Agent name (optional)
                    </span>
                    <input
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        placeholder="your-agent-name"
                        spellCheck={false}
                        className="w-full rounded-md border px-3 py-2 font-mono text-sm"
                    />
                </label>
                {error != null && <p className="text-sm text-red-600">{error}</p>}
                <button
                    type="button"
                    disabled={!gatewayUrl.trim()}
                    onClick={handleSubmit}
                    className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
                >
                    Continue
                </button>
            </div>
        </main>
    );
}
