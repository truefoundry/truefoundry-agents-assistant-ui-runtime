"use client";

import { useMemo } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { getDefaultAgentName, getGatewayUrl } from "@/lib/auth/config";

export type GatewayCredentials = {
    apiKey: string;
    gatewayUrl: string;
    agentName?: string;
};

export function useGatewayCredentials(): GatewayCredentials {
    const { token } = useAuth();

    return useMemo(
        () => ({
            apiKey: token,
            gatewayUrl: getGatewayUrl(),
            agentName: getDefaultAgentName(),
        }),
        [token],
    );
}
