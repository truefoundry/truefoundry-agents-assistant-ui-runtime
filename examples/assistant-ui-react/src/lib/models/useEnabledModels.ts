"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { getControlPlaneUrl } from "@/lib/auth/config";
import { listEnabledModels, type ModelEntry } from "@/lib/models/listEnabledModels";

interface UseEnabledModelsResult {
    models: ModelEntry[];
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useEnabledModels(): UseEnabledModelsResult {
    const { token } = useAuth();
    const [models, setModels] = useState<ModelEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

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
                const result = await listEnabledModels(cpUrl, token);
                if (!cancelled) setModels(result);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load models.");
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

    return { models, isLoading, error, refresh };
}
