"use client";

import {
    createContext,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";

export type AgentRuntimeMode = "named" | "draft";

const AgentModeContext = createContext<{
    mode: AgentRuntimeMode;
    setMode: (mode: AgentRuntimeMode) => void;
} | null>(null);

export function AgentModeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<AgentRuntimeMode>("named");
    const value = useMemo(() => ({ mode, setMode }), [mode]);
    return (
        <AgentModeContext.Provider value={value}>{children}</AgentModeContext.Provider>
    );
}

export function useAgentMode() {
    const context = useContext(AgentModeContext);
    if (context == null) {
        throw new Error("useAgentMode must be used within AgentModeProvider.");
    }
    return context;
}
