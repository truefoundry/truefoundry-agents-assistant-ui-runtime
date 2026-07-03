"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { getControlPlaneUrl } from "@/lib/auth/config";
import { useGatewayCredentials } from "@/lib/chat/gatewayCredentials";
import {
    authorizeMcpServer,
    listMcpServers,
    type ConnectorState,
} from "@/lib/connectors/listMcpServers";

interface UseMcpServersResult {
    connectors: ConnectorState[];
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
    connect: (
        connector: ConnectorState,
        options?: { onAuthenticated?: (mcpName: string) => void },
    ) => Promise<void>;
    isConnecting: string | null;
}

export function useMcpServers(): UseMcpServersResult {
    const { token } = useAuth();
    const { gatewayUrl } = useGatewayCredentials();
    const [connectors, setConnectors] = useState<ConnectorState[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isConnecting, setIsConnecting] = useState<string | null>(null);
    const pendingAuthCallback = useRef<{
        mcpName: string;
        onAuthenticated: (mcpName: string) => void;
    } | null>(null);

    const refresh = useCallback(() => {
        setRefreshKey((key) => key + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            setError(null);
            try {
                const cpUrl = getControlPlaneUrl();
                const result = await listMcpServers(cpUrl, token);
                if (!cancelled) setConnectors(result);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load connectors.");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [token, refreshKey]);

    useEffect(() => {
        function onFocus() {
            refresh();
        }
        function onMessage(event: MessageEvent) {
            if (event.data?.type === "mcp-oauth-success") {
                refresh();
                const pending = pendingAuthCallback.current;
                pendingAuthCallback.current = null;
                pending?.onAuthenticated(pending.mcpName);
            }
        }
        window.addEventListener("focus", onFocus);
        window.addEventListener("message", onMessage);
        return () => {
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("message", onMessage);
        };
    }, [refresh]);

    const connect = useCallback(
        async (
            connector: ConnectorState,
            options?: { onAuthenticated?: (mcpName: string) => void },
        ) => {
            if (connector.serverId == null) return;
            setIsConnecting(connector.mcpName);
            try {
                const cpUrl = getControlPlaneUrl();
                const result = await authorizeMcpServer(
                    cpUrl,
                    token,
                    connector.serverId,
                    gatewayUrl,
                );
                if (result.status === "authentication_required") {
                    if (options?.onAuthenticated != null) {
                        pendingAuthCallback.current = {
                            mcpName: connector.mcpName,
                            onAuthenticated: options.onAuthenticated,
                        };
                    }
                    window.open(
                        result.authorizationUrl,
                        "mcp-oauth",
                        "width=520,height=720,noopener",
                    );
                } else {
                    refresh();
                    options?.onAuthenticated?.(connector.mcpName);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to connect MCP server.");
            } finally {
                setIsConnecting(null);
            }
        },
        [gatewayUrl, refresh, token],
    );

    return { connectors, isLoading, error, refresh, connect, isConnecting };
}
