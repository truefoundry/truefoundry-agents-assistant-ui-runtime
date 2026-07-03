"use client";

import { useEffect, useMemo, useState } from "react";
import { Popover } from "radix-ui";
import { ChevronUpIcon, SearchIcon, SparklesIcon } from "lucide-react";
import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

import { cn } from "@/lib/utils";
import { useEnabledModels } from "@/lib/models/useEnabledModels";
import type { ModelEntry } from "@/lib/models/listEnabledModels";

const pillClassName = cn(
    "flex h-6 items-center gap-1 rounded-2xl px-1.5 text-xs font-medium text-[#162235]",
    "hover:bg-[#e8f2fe]/60 data-[state=open]:bg-[#e8f2fe]/60",
);

const panelClassName = cn(
    "z-50 flex w-[30rem] flex-col overflow-hidden rounded-lg border border-[#e0ecfd] bg-white text-[#162235]",
    "shadow-[0px_2px_3px_rgba(0,52,102,0.06),0px_8px_10px_rgba(0,52,102,0.1)]",
);

const searchClassName = cn(
    "mx-3 flex items-center gap-1.5 rounded border border-[#cee0f8] bg-[#f0f7ff] px-2 py-1.5 text-xs",
);

const PROVIDER_ICON_COLORS = [
    "#6366f1",
    "#0ea5e9",
    "#f59e0b",
    "#10b981",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
] as const;

type ProviderGroup = {
    providerAccount: string;
    models: ModelEntry[];
};

function providerIconColor(account: string): string {
    let hash = 0;
    for (const char of account) {
        hash = (hash + char.charCodeAt(0)) % PROVIDER_ICON_COLORS.length;
    }
    return PROVIDER_ICON_COLORS[hash] ?? PROVIDER_ICON_COLORS[0];
}

function providerMonogram(account: string): string {
    const trimmed = account.trim();
    if (!trimmed) return "?";
    return trimmed.charAt(0).toUpperCase();
}

function parseProviderAccount(apiModel: string): string {
    const slash = apiModel.indexOf("/");
    return slash > 0 ? apiModel.slice(0, slash) : apiModel;
}

function groupModelsByProvider(models: ModelEntry[], currentApiModel: string): ProviderGroup[] {
    const groups = new Map<string, ModelEntry[]>();

    for (const entry of models) {
        const bucket = groups.get(entry.providerAccount) ?? [];
        bucket.push(entry);
        groups.set(entry.providerAccount, bucket);
    }

    if (
        currentApiModel &&
        !models.some((entry) => entry.apiModel === currentApiModel)
    ) {
        const account = parseProviderAccount(currentApiModel);
        const bucket = groups.get(account) ?? [];
        const modelId =
            currentApiModel.indexOf("/") > 0
                ? currentApiModel.slice(currentApiModel.indexOf("/") + 1)
                : currentApiModel;
        bucket.push({
            id: currentApiModel,
            name: modelId,
            provider: "",
            providerAccount: account,
            apiModel: currentApiModel,
            modelId,
        });
        groups.set(account, bucket);
    }

    return [...groups.entries()]
        .map(([providerAccount, accountModels]) => ({
            providerAccount,
            models: accountModels.sort((a, b) => a.modelId.localeCompare(b.modelId)),
        }))
        .sort((a, b) => a.providerAccount.localeCompare(b.providerAccount));
}

function matchesQuery(entry: ModelEntry, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
        entry.modelId.toLowerCase().includes(needle) ||
        entry.name.toLowerCase().includes(needle) ||
        entry.apiModel.toLowerCase().includes(needle) ||
        entry.providerAccount.toLowerCase().includes(needle)
    );
}

type DraftModelSelectorProps = {
    model: AgentSpec["model"];
    disabled?: boolean;
    onChange: (model: AgentSpec["model"]) => void;
};

export function DraftModelSelector({
    model,
    disabled,
    onChange,
}: DraftModelSelectorProps) {
    const { models, isLoading, error } = useEnabledModels();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

    const groups = useMemo(
        () => groupModelsByProvider(models, model.name),
        [models, model.name],
    );

    const filteredGroups = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return groups;

        return groups
            .map((group) => ({
                ...group,
                models: group.models.filter((entry) => matchesQuery(entry, needle)),
            }))
            .filter(
                (group) =>
                    group.models.length > 0 ||
                    group.providerAccount.toLowerCase().includes(needle),
            );
    }, [groups, query]);

    useEffect(() => {
        if (!open) {
            setQuery("");
            return;
        }

        const currentAccount = parseProviderAccount(model.name);
        const hasCurrent = filteredGroups.some(
            (group) => group.providerAccount === currentAccount,
        );
        const fallback = filteredGroups[0]?.providerAccount ?? null;
        setSelectedAccount(hasCurrent ? currentAccount : fallback);
    }, [open, model.name, filteredGroups]);

    const activeGroup =
        filteredGroups.find((group) => group.providerAccount === selectedAccount) ??
        filteredGroups[0] ??
        null;

    const displayLabel = useMemo(() => {
        const match = models.find((entry) => entry.apiModel === model.name);
        if (match != null) return match.name;
        const slash = model.name.indexOf("/");
        return slash > 0 ? model.name.slice(slash + 1) : model.name;
    }, [models, model.name]);

    function handleSelect(entry: ModelEntry) {
        onChange({ ...model, name: entry.apiModel });
        setOpen(false);
    }

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild disabled={disabled}>
                <button type="button" className={pillClassName} aria-label="Select model">
                    <SparklesIcon className="size-3.5 shrink-0 text-[#4d6896]" />
                    <span className="max-w-[9rem] truncate">{displayLabel}</span>
                    <ChevronUpIcon className="size-4 shrink-0 text-[#4d6896]" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="top"
                    align="end"
                    sideOffset={8}
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    className={panelClassName}
                >
                    <div className="border-b border-[#e0ecfd] px-3 py-2">
                        <p className="text-xs font-medium text-[#162235]">Select model</p>
                    </div>

                    <label className={cn(searchClassName, "mt-3")}>
                        <SearchIcon className="size-3.5 shrink-0 text-[#82a0ce]" />
                        <input
                            type="search"
                            value={query}
                            placeholder="Search"
                            onChange={(event) => setQuery(event.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-[#162235] outline-none placeholder:text-[#5e7baa]"
                        />
                    </label>

                    <div className="mt-3 flex min-h-[16rem] border-t border-[#e0ecfd]">
                        <div className="flex w-[11.5rem] shrink-0 flex-col border-r border-[#e0ecfd]">
                            <div className="max-h-64 overflow-y-auto py-1">
                                {isLoading && filteredGroups.length === 0 ? (
                                    <p className="px-3 py-2 text-xs text-[#5e7baa]">
                                        Loading providers…
                                    </p>
                                ) : error != null && filteredGroups.length === 0 ? (
                                    <p className="px-3 py-2 text-xs text-red-600">{error}</p>
                                ) : filteredGroups.length === 0 ? (
                                    <p className="px-3 py-2 text-xs text-[#5e7baa]">
                                        No providers found.
                                    </p>
                                ) : (
                                    filteredGroups.map((group) => {
                                        const isActive =
                                            group.providerAccount === activeGroup?.providerAccount;
                                        return (
                                            <button
                                                key={group.providerAccount}
                                                type="button"
                                                onClick={() =>
                                                    setSelectedAccount(group.providerAccount)
                                                }
                                                className={cn(
                                                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs",
                                                    "hover:bg-[#e8f2fe]/60",
                                                    isActive && "bg-[#e8f2fe]",
                                                )}
                                            >
                                                <span
                                                    className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
                                                    style={{
                                                        backgroundColor: providerIconColor(
                                                            group.providerAccount,
                                                        ),
                                                    }}
                                                >
                                                    {providerMonogram(group.providerAccount)}
                                                </span>
                                                <span className="min-w-0 truncate font-medium text-[#162235]">
                                                    {group.providerAccount}
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="min-w-0 flex-1">
                            {activeGroup == null ? (
                                <p className="px-3 py-2 text-xs text-[#5e7baa]">
                                    Select a provider.
                                </p>
                            ) : (
                                <>
                                    <div className="border-b border-[#e0ecfd] px-3 py-2">
                                        <p className="truncate text-xs font-medium text-[#162235]">
                                            {activeGroup.providerAccount}
                                        </p>
                                    </div>
                                    <div className="max-h-[14.5rem] overflow-y-auto py-1">
                                        {activeGroup.models.length === 0 ? (
                                            <p className="px-3 py-2 text-xs text-[#5e7baa]">
                                                No models found.
                                            </p>
                                        ) : (
                                            activeGroup.models.map((entry) => {
                                                const isSelected =
                                                    entry.apiModel === model.name;
                                                return (
                                                    <button
                                                        key={entry.apiModel}
                                                        type="button"
                                                        onClick={() => handleSelect(entry)}
                                                        className={cn(
                                                            "flex w-full px-3 py-1.5 text-left text-xs text-[#162235]",
                                                            "hover:bg-[#e8f2fe]/60",
                                                            isSelected && "bg-[#e8f2fe]",
                                                        )}
                                                    >
                                                        <span className="truncate">
                                                            {entry.modelId}
                                                        </span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
