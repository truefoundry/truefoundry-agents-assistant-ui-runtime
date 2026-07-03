"use client";

import { PlugIcon } from "lucide-react";
import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

import { useDraftComposerCatalog } from "@/components/draft/DraftComposerCatalog";
import { draftIconClassName } from "@/components/draft/draftComposerStyles";
import { connectorMonogram } from "@/components/draft/draftSelection";
import { DraftSelectionChip } from "@/components/draft/DraftSelectionChip";
import { cn } from "@/lib/utils";

type DraftConnectorChipsProps = {
    selected: NonNullable<AgentSpec["mcpServers"]>;
};

export function DraftConnectorChips({ selected }: DraftConnectorChipsProps) {
    const { connectors } = useDraftComposerCatalog();

    if (selected.length === 0) {
        return null;
    }

    return (
        <>
            {selected.map((server) => {
                const connector = connectors.find((item) => item.mcpName === server.name);
                const label = connector?.name ?? server.name;
                return (
                    <DraftSelectionChip key={server.name} label={label}>
                        {connector == null ? (
                            <PlugIcon className={cn("size-3", draftIconClassName)} />
                        ) : (
                            <span>{connectorMonogram(label)}</span>
                        )}
                    </DraftSelectionChip>
                );
            })}
        </>
    );
}
