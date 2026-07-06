"use client";

import { useMemo, useState } from "react";
import { PlugIcon } from "lucide-react";
import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

import { useDraftComposerCatalog } from "@/components/draft/DraftComposerCatalog";
import {
    isConnectorSelected,
    toggleConnector,
} from "@/components/draft/draftSelection";
import {
    DraftSelectorConnectButton,
    DraftSelectorList,
    DraftSelectorRow,
    DraftSelectorSearch,
    DraftSelectorSectionHeader,
    draftMutedTextClassName,
} from "@/components/draft/DraftSelectorPanel";
import { cn } from "@/lib/utils";

type DraftConnectorSelectorPanelProps = {
    selected: NonNullable<AgentSpec["mcpServers"]>;
    disabled?: boolean;
    onChange: (mcpServers: NonNullable<AgentSpec["mcpServers"]>) => void;
};

export function DraftConnectorSelectorPanel({
    selected,
    disabled,
    onChange,
}: DraftConnectorSelectorPanelProps) {
    const [query, setQuery] = useState("");
    const {
        connectors,
        connectorsLoading: isLoading,
        connectorsError: error,
        connect,
        isConnecting,
    } = useDraftComposerCatalog();

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return connectors;
        return connectors.filter((connector) =>
            connector.name.toLowerCase().includes(needle),
        );
    }, [connectors, query]);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
            <DraftSelectorSearch
                value={query}
                disabled={disabled}
                placeholder="Search connectors..."
                onChange={setQuery}
            />
            <DraftSelectorSectionHeader label={`AVAILABLE (${filtered.length})`} />
            <DraftSelectorList isLoading={isLoading} error={error}>
                {filtered.length === 0 && !isLoading && !error ? (
                    <p className={cn("px-2 py-2 text-xs", draftMutedTextClassName)}>No connectors found.</p>
                ) : (
                    filtered.map((connector) => {
                        const checked = isConnectorSelected(selected, connector.mcpName);
                        const needsConnect =
                            !connector.noAuthUi && !connector.authenticated;
                        return (
                            <DraftSelectorRow
                                key={connector.mcpName}
                                icon={<PlugIcon className="size-3.5" />}
                                label={connector.name}
                                checked={checked}
                                disabled={disabled}
                                trailing={
                                    needsConnect ? (
                                        <DraftSelectorConnectButton
                                            disabled={disabled}
                                            loading={isConnecting === connector.mcpName}
                                            onClick={() =>
                                                void connect(connector, {
                                                    onAuthenticated: (mcpName) => {
                                                        const match = connectors.find(
                                                            (item) =>
                                                                item.mcpName === mcpName,
                                                        );
                                                        if (match != null) {
                                                            onChange(
                                                                toggleConnector(
                                                                    selected,
                                                                    match,
                                                                    true,
                                                                ),
                                                            );
                                                        }
                                                    },
                                                })
                                            }
                                        />
                                    ) : undefined
                                }
                                onCheckedChange={(next) =>
                                    onChange(toggleConnector(selected, connector, next))
                                }
                            />
                        );
                    })
                )}
            </DraftSelectorList>
        </div>
    );
}
