"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { getControlPlaneUrl } from "@/lib/auth/config";
import { listAgentSkills, type AgentSkill } from "@/lib/skills/listAgentSkills";

interface UseAgentSkillsResult {
    skills: AgentSkill[];
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useAgentSkills(): UseAgentSkillsResult {
    const { token } = useAuth();
    const [skills, setSkills] = useState<AgentSkill[]>([]);
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
                const result = await listAgentSkills(cpUrl, token);
                if (!cancelled) setSkills(result);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load skills.");
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

    return { skills, isLoading, error, refresh };
}
