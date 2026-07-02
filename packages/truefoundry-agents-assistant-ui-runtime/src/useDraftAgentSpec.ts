"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    mergeAgentSpec,
    type AgentSpec,
    type AgentSpecUpdate,
} from "./agentSpec.js";
import type { DraftSessionBridge } from "./draftSessionBridge.js";

const SPEC_SYNC_DEBOUNCE_MS = 400;

export type UseDraftAgentSpecOptions = {
    draftSessionId: string | undefined;
    draftBridge: DraftSessionBridge | null;
    defaultAgentSpec: AgentSpec;
    onAgentSpecChange?: ((spec: AgentSpec) => void) | undefined;
    onError?: ((error: unknown) => void) | undefined;
};

export function useDraftAgentSpec({
    draftSessionId,
    draftBridge,
    defaultAgentSpec,
    onAgentSpecChange,
    onError,
}: UseDraftAgentSpecOptions) {
    const enabled = draftBridge != null;
    const [agentSpec, setAgentSpec] = useState<AgentSpec>(defaultAgentSpec);
    const [isSpecSyncing, setIsSpecSyncing] = useState(false);
    const [specError, setSpecError] = useState<unknown | null>(null);

    const agentSpecRef = useRef(agentSpec);
    agentSpecRef.current = agentSpec;

    const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const syncGenerationRef = useRef(0);
    const loadedDraftIdRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!enabled || draftBridge == null) {
            return;
        }
        if (draftSessionId == null) {
            loadedDraftIdRef.current = undefined;
            setAgentSpec(defaultAgentSpec);
            setSpecError(null);
            return;
        }

        if (loadedDraftIdRef.current === draftSessionId) {
            return;
        }

        let cancelled = false;
        void (async () => {
            try {
                const loaded = await draftBridge.getDraftAgentSpec(draftSessionId);
                if (cancelled) {
                    return;
                }
                loadedDraftIdRef.current = draftSessionId;
                setAgentSpec(loaded);
                setSpecError(null);
            } catch (error) {
                if (!cancelled) {
                    onError?.(error);
                    setSpecError(error);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [defaultAgentSpec, draftBridge, draftSessionId, enabled, onError]);

    const flushSpecSync = useCallback(
        async (draftId: string, spec: AgentSpec, generation: number) => {
            if (draftBridge == null) {
                return;
            }
            setIsSpecSyncing(true);
            try {
                await draftBridge.syncAgentSpec(draftId, spec);
                if (generation !== syncGenerationRef.current) {
                    return;
                }
                setSpecError(null);
                onAgentSpecChange?.(spec);
            } catch (error) {
                if (generation === syncGenerationRef.current) {
                    setSpecError(error);
                    onError?.(error);
                }
            } finally {
                if (generation === syncGenerationRef.current) {
                    setIsSpecSyncing(false);
                }
            }
        },
        [draftBridge, onAgentSpecChange, onError],
    );

    const scheduleSpecSync = useCallback(
        (draftId: string, spec: AgentSpec) => {
            if (syncTimeoutRef.current != null) {
                clearTimeout(syncTimeoutRef.current);
            }
            const generation = ++syncGenerationRef.current;
            syncTimeoutRef.current = setTimeout(() => {
                void flushSpecSync(draftId, spec, generation);
            }, SPEC_SYNC_DEBOUNCE_MS);
        },
        [flushSpecSync],
    );

    useEffect(
        () => () => {
            if (syncTimeoutRef.current != null) {
                clearTimeout(syncTimeoutRef.current);
            }
        },
        [],
    );

    const updateAgentSpec = useCallback(
        (update: AgentSpecUpdate) => {
            if (!enabled || draftSessionId == null || draftBridge == null) {
                return;
            }
            const next = mergeAgentSpec(agentSpecRef.current, update);
            setAgentSpec(next);
            scheduleSpecSync(draftSessionId, next);
        },
        [draftSessionId, enabled, draftBridge, scheduleSpecSync],
    );

    return useMemo(
        () => ({
            agentSpec: enabled ? agentSpec : null,
            draftSessionId: enabled ? draftSessionId : undefined,
            isSpecSyncing: enabled ? isSpecSyncing : false,
            specError: enabled ? specError : null,
            updateAgentSpec,
        }),
        [
            agentSpec,
            draftSessionId,
            enabled,
            isSpecSyncing,
            specError,
            updateAgentSpec,
        ],
    );
}
