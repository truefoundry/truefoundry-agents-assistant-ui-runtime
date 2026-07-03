"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { getControlPlaneUrl } from "@/lib/auth/config";
import { listAgents, type SampleAgent } from "@/lib/agents/listAgents";

interface UseAgentsResult {
    agents: SampleAgent[];
    isLoading: boolean;
    error: string | null;
}

export function useAgents(): UseAgentsResult {
    const { token } = useAuth();
    const [agents, setAgents] = useState<SampleAgent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            setError(null);
            try {
                const cpUrl = getControlPlaneUrl();
                const result = await listAgents(cpUrl, token);
                if (!cancelled) setAgents(result);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load agents.");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [token]);

    return { agents, isLoading, error };
}
