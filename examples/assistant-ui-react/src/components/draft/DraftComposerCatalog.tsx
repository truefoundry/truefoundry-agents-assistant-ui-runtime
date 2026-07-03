"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useMcpServers } from "@/lib/connectors/useMcpServers";
import type { ConnectorState } from "@/lib/connectors/listMcpServers";
import { useAgentSkills } from "@/lib/skills/useAgentSkills";
import type { AgentSkill } from "@/lib/skills/listAgentSkills";

type DraftComposerCatalogValue = {
    connectors: ConnectorState[];
    connectorsLoading: boolean;
    connectorsError: string | null;
    refreshConnectors: () => void;
    connect: (
        connector: ConnectorState,
        options?: { onAuthenticated?: (mcpName: string) => void },
    ) => Promise<void>;
    isConnecting: string | null;
    skills: AgentSkill[];
    skillsLoading: boolean;
    skillsError: string | null;
    refreshSkills: () => void;
};

const DraftComposerCatalogContext = createContext<DraftComposerCatalogValue | null>(null);

export function DraftComposerCatalogProvider({ children }: { children: ReactNode }) {
    const {
        connectors,
        isLoading: connectorsLoading,
        error: connectorsError,
        refresh: refreshConnectors,
        connect,
        isConnecting,
    } = useMcpServers();
    const {
        skills,
        isLoading: skillsLoading,
        error: skillsError,
        refresh: refreshSkills,
    } = useAgentSkills();

    return (
        <DraftComposerCatalogContext.Provider
            value={{
                connectors,
                connectorsLoading,
                connectorsError,
                refreshConnectors,
                connect,
                isConnecting,
                skills,
                skillsLoading,
                skillsError,
                refreshSkills,
            }}
        >
            {children}
        </DraftComposerCatalogContext.Provider>
    );
}

export function useDraftComposerCatalog(): DraftComposerCatalogValue {
    const value = useContext(DraftComposerCatalogContext);
    if (value == null) {
        throw new Error("useDraftComposerCatalog must be used within DraftComposerCatalogProvider.");
    }
    return value;
}
