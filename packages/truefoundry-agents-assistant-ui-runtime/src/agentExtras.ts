"use client";

import { createRuntimeExtras } from "@assistant-ui/core/internal";
import type { AssistantClient } from "@assistant-ui/store";
import { useAui } from "@assistant-ui/store";
import { useCallback, useSyncExternalStore } from "react";
import type { McpAuthRequiredEvent } from "./server/index.js";

import type { AgentSpec } from "./server/types.js";
import type { AgentSpecUpdate } from "./draft/agentSpec.js";
import type { PendingApproval, PendingToolResponse } from "./collectPending.js";
import type { RespondToToolApprovalOptions } from "./toolApproval.js";
import type { RespondToToolResponseOptions } from "./toolResponse.js";

export type { PendingApproval, PendingToolResponse };

export type DraftRuntimeExtras = {
    agentSpec: AgentSpec | null;
    draftSessionId: string | undefined;
    isSpecLoading: boolean;
    isSpecSyncing: boolean;
    specError: unknown | null;
    updateAgentSpec: (update: AgentSpecUpdate) => void;
    flushAgentSpec: () => Promise<void>;
    adoptAgentSpec: (request: {
        agentSpec: AgentSpec;
        updatedAt?: string;
    }) => void;
};

export type AgentRuntimeExtras = {
    pendingApprovals: PendingApproval[];
    pendingToolResponses: PendingToolResponse[];
    pendingMcpAuth: { mcpServers: McpAuthRequiredEvent["mcpServers"] } | null;
    resumeUnavailable: boolean;
    sandboxId: string | undefined;
    respondToToolApproval: (response: RespondToToolApprovalOptions) => void;
    respondToToolResponse: (response: RespondToToolResponseOptions) => void;
    resumeMcpAuth: () => Promise<void>;
    downloadSandboxFile: (req: { turnId: string; path: string }) => Promise<Blob>;
    cancel: () => Promise<void>;
    resetFromTurn: (turnId: string) => Promise<void>;
    reload: () => void;
    hasOlderHistory: boolean;
    isLoadingOlderHistory: boolean;
    loadOlderHistory: () => Promise<void>;
    draft: DraftRuntimeExtras | null;
};

const extrasBrand = createRuntimeExtras<AgentRuntimeExtras>("useAgentRuntime");

export const EMPTY_DRAFT_EXTRAS: DraftRuntimeExtras = {
    agentSpec: null,
    draftSessionId: undefined,
    isSpecLoading: false,
    isSpecSyncing: false,
    specError: null,
    updateAgentSpec: () => {
        throw new Error("Draft agent extras are only available in draft mode.");
    },
    flushAgentSpec: async () => {
        throw new Error("Draft agent extras are only available in draft mode.");
    },
    adoptAgentSpec: () => {
        throw new Error("Draft agent extras are only available in draft mode.");
    },
};

type SubscribeFn = (onStoreChange: () => void) => () => void;

/**
 * Walk `Object.create(parent)` AUI clients. Stops before leaving the chain.
 * Callers must try/catch RootAssistantClient proxy gets (it throws on any
 * missing accessor such as `subscribe` / `thread`).
 */
function walkAssistantClientAncestors(
    client: AssistantClient,
    visit: (current: object) => "continue" | "stop",
): void {
    let current: object | null = client;
    const seen = new Set<object>();
    while (current != null && !seen.has(current)) {
        seen.add(current);
        if (visit(current) === "stop") return;
        const parent = Object.getPrototypeOf(current);
        if (parent == null || parent === Object.prototype) {
            return;
        }
        current = parent;
    }
}

/**
 * `PartPrimitive.Messages` wraps sub-agent threads in `ReadonlyThreadProvider`,
 * which shadows `thread` (and therefore `thread.extras`) with a readonly client
 * that has no agent extras. Nested AUI clients are `Object.create(parent)`,
 * so walk the prototype chain to reach the root runtime extras.
 */
export function tryGetAgentExtras(
    client: AssistantClient,
): AgentRuntimeExtras | undefined {
    let found: AgentRuntimeExtras | undefined;
    walkAssistantClientAncestors(client, (current) => {
        try {
            const thread = (current as AssistantClient).thread;
            if (typeof thread === "function") {
                const extras = extrasBrand.tryGet(thread().getState().extras);
                if (extras != null) {
                    found = extras;
                    return "stop";
                }
            }
        } catch {
            // Nested/readonly clients may lack thread; RootAssistantClient proxy
            // throws on missing scope accessors ("thread" / "subscribe").
        }
        return "continue";
    });
    return found;
}

export function getAgentExtras(client: AssistantClient): AgentRuntimeExtras {
    const extras = tryGetAgentExtras(client);
    if (extras == null) {
        throw new Error(
            "The current thread is not backed by the useAgentRuntime runtime.",
        );
    }
    return extras;
}

function subscribeClientChain(client: AssistantClient): SubscribeFn {
    return (onStoreChange) => {
        const unsubs: Array<() => void> = [];
        walkAssistantClientAncestors(client, (current) => {
            try {
                const subscribe = (current as { subscribe?: SubscribeFn }).subscribe;
                if (typeof subscribe === "function") {
                    unsubs.push(subscribe(onStoreChange));
                }
                return "continue";
            } catch {
                // RootAssistantClient proxy — no further usable ancestors.
                return "stop";
            }
        });
        return () => {
            for (const unsub of unsubs) {
                unsub();
            }
        };
    };
}

/**
 * Resolves agent extras from the nearest ancestor runtime, including
 * inside nested readonly sub-agent renderers (`PartPrimitive.Messages`).
 */
export function useAgentRuntimeExtras(): AgentRuntimeExtras | undefined {
    const aui = useAui();
    const subscribe = useCallback(subscribeClientChain(aui), [aui]);
    const getSnapshot = useCallback(() => tryGetAgentExtras(aui), [aui]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useAgentExtrasApi(): AgentRuntimeExtras;
function useAgentExtrasApi<S>(select: (extras: AgentRuntimeExtras) => S): S;
function useAgentExtrasApi<S>(
    select: (extras: AgentRuntimeExtras) => S,
    fallback: S,
): S;
function useAgentExtrasApi<S>(
    select?: (extras: AgentRuntimeExtras) => S,
    fallback?: S,
): AgentRuntimeExtras | S {
    const extras = useAgentRuntimeExtras();
    const hasFallback = arguments.length >= 2;
    if (extras == null) {
        if (hasFallback) return fallback as S;
        throw new Error(
            "The current thread is not backed by the useAgentRuntime runtime.",
        );
    }
    return select != null ? select(extras) : extras;
}

/**
 * Brand + provide/tryGet from assistant-ui; get/use walk ancestor AUI clients so
 * nested readonly sub-agent threads still resolve root agent extras.
 */
export const agentExtras = {
    provide: extrasBrand.provide,
    is: extrasBrand.is,
    tryGet: extrasBrand.tryGet,
    get: getAgentExtras,
    use: useAgentExtrasApi,
};
