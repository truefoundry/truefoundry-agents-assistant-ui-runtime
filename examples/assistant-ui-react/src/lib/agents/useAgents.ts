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

// Module-level cache so remounting the sidebar (e.g. when navigating between
// agent pages) reuses the last fetch instead of re-issuing "list agents" for
// every remount.
let cachedAgents: SampleAgent[] | undefined;
let cachedToken: string | undefined;
let inflightRequest: Promise<SampleAgent[]> | undefined;

function fetchAgents(token: string): Promise<SampleAgent[]> {
    if (cachedAgents != null && cachedToken === token) {
        return Promise.resolve(cachedAgents);
    }
    if (inflightRequest == null || cachedToken !== token) {
        cachedToken = token;
        inflightRequest = listAgents(getControlPlaneUrl(), token)
            .then((result) => {
                cachedAgents = result;
                return result;
            })
            .finally(() => {
                inflightRequest = undefined;
            });
    }
    return inflightRequest;
}

export function useAgents(): UseAgentsResult {
    const { token } = useAuth();
    const [agents, setAgents] = useState<SampleAgent[]>(cachedAgents ?? []);
    const [isLoading, setIsLoading] = useState(cachedAgents == null || cachedToken !== token);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            setError(null);
            try {
                const result = await fetchAgents(token);
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
