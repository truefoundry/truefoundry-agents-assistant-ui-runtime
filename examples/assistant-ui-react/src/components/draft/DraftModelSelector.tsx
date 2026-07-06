"use client";

import { useEffect, useMemo, useState } from "react";
import { Popover } from "radix-ui";
import { ChevronRightIcon, ChevronUpIcon, SearchIcon } from "lucide-react";
import type { AgentSpec, AgentSpecUpdate } from "truefoundry-agents-assistant-ui-runtime";

import { DraftBottomSheet } from "@/components/draft/DraftBottomSheet";
import {
    draftIconClassName,
    draftMutedTextClassName,
    draftPillClassName,
    draftPopoverPanelClassName,
    draftRowActiveClassName,
    draftRowHoverClassName,
    draftSearchClassName,
} from "@/components/draft/draftComposerStyles";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";
import { useEnabledModels } from "@/lib/models/useEnabledModels";
import type { ModelEntry } from "@/lib/models/listEnabledModels";

const panelClassName = cn(draftPopoverPanelClassName, "flex w-[30rem] flex-col");

const searchClassName = cn(draftSearchClassName, "mx-3 px-2 py-1.5");

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
    onChange: (model: NonNullable<AgentSpecUpdate["model"]>) => void;
};

export function DraftModelSelector({
    model,
    disabled,
    onChange,
}: DraftModelSelectorProps) {
    const isMobile = useIsMobile();
    const { models, isLoading, error } = useEnabledModels();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [mobileStep, setMobileStep] = useState<"providers" | "models">("providers");

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

    useEffect(() => {
        if (open) setMobileStep("providers");
    }, [open]);

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

    const providerAccount = parseProviderAccount(model.name);

    function handleSelect(entry: ModelEntry) {
        onChange({ name: entry.apiModel });
        setOpen(false);
    }

    const pillContent = (
        <>
            <span
                className="flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
                style={{ backgroundColor: providerIconColor(providerAccount) }}
            >
                {providerMonogram(providerAccount)}
            </span>
            <span className="max-w-[9rem] truncate">{displayLabel}</span>
            <ChevronUpIcon className={cn("size-4 shrink-0", draftIconClassName)} />
        </>
    );

    if (isMobile) {
        const sheetTitle = mobileStep === "models" ? (activeGroup?.providerAccount ?? "Select model") : "Select model";

        return (
            <>
                <button
                    type="button"
                    className={draftPillClassName}
                    aria-label="Select model"
                    onClick={() => setOpen(true)}
                >
                    {pillContent}
                </button>
                <DraftBottomSheet
                    open={open}
                    onOpenChange={setOpen}
                    title={sheetTitle}
                    onBack={mobileStep === "models" ? () => setMobileStep("providers") : undefined}
                >
                    <label className={cn(searchClassName, "mx-0 mt-2")}>
                        <SearchIcon className={cn("size-3.5 shrink-0", draftMutedTextClassName)} />
                        <input
                            type="search"
                            value={query}
                            placeholder="Search"
                            onChange={(event) => setQuery(event.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                        />
                    </label>

                    <div className="mt-2 flex flex-col py-1">
                        {mobileStep === "providers" ? (
                            isLoading && filteredGroups.length === 0 ? (
                                <p className={cn("px-1 py-2 text-sm", draftMutedTextClassName)}>
                                    Loading providers…
                                </p>
                            ) : error != null && filteredGroups.length === 0 ? (
                                <p className="px-1 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
                            ) : filteredGroups.length === 0 ? (
                                <p className={cn("px-1 py-2 text-sm", draftMutedTextClassName)}>
                                    No providers found.
                                </p>
                            ) : (
                                filteredGroups.map((group) => (
                                    <button
                                        key={group.providerAccount}
                                        type="button"
                                        onClick={() => {
                                            setSelectedAccount(group.providerAccount);
                                            setMobileStep("models");
                                        }}
                                        className={cn(
                                            "flex w-full items-center gap-2 rounded px-1 py-2.5 text-left text-sm text-foreground",
                                            draftRowHoverClassName,
                                        )}
                                    >
                                        <span
                                            className="flex size-6 shrink-0 items-center justify-center rounded text-xs font-semibold text-white"
                                            style={{
                                                backgroundColor: providerIconColor(group.providerAccount),
                                            }}
                                        >
                                            {providerMonogram(group.providerAccount)}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate font-medium">
                                            {group.providerAccount}
                                        </span>
                                        <ChevronRightIcon className={cn("size-4 shrink-0", draftIconClassName)} />
                                    </button>
                                ))
                            )
                        ) : activeGroup == null ? (
                            <p className={cn("px-1 py-2 text-sm", draftMutedTextClassName)}>Select a provider.</p>
                        ) : activeGroup.models.length === 0 ? (
                            <p className={cn("px-1 py-2 text-sm", draftMutedTextClassName)}>No models found.</p>
                        ) : (
                            activeGroup.models.map((entry) => {
                                const isSelected = entry.apiModel === model.name;
                                return (
                                    <button
                                        key={entry.apiModel}
                                        type="button"
                                        onClick={() => handleSelect(entry)}
                                        className={cn(
                                            "flex w-full rounded px-1 py-2.5 text-left text-sm text-foreground",
                                            draftRowHoverClassName,
                                            isSelected && draftRowActiveClassName,
                                        )}
                                    >
                                        <span className="truncate">{entry.modelId}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </DraftBottomSheet>
            </>
        );
    }

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild disabled={disabled}>
                <button type="button" className={draftPillClassName} aria-label="Select model">
                    {pillContent}
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
                    <div className="border-b border-border px-3 py-2">
                        <p className="text-xs font-medium text-foreground">Select model</p>
                    </div>

                    <label className={cn(searchClassName, "mt-3")}>
                        <SearchIcon className={cn("size-3.5 shrink-0", draftMutedTextClassName)} />
                        <input
                            type="search"
                            value={query}
                            placeholder="Search"
                            onChange={(event) => setQuery(event.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                        />
                    </label>

                    <div className="mt-3 flex min-h-[16rem] border-t border-border">
                        <div className="flex w-[11.5rem] shrink-0 flex-col border-r border-border">
                            <div className="max-h-64 overflow-y-auto py-1">
                                {isLoading && filteredGroups.length === 0 ? (
                                    <p className={cn("px-3 py-2 text-xs", draftMutedTextClassName)}>
                                        Loading providers…
                                    </p>
                                ) : error != null && filteredGroups.length === 0 ? (
                                    <p className="px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>
                                ) : filteredGroups.length === 0 ? (
                                    <p className={cn("px-3 py-2 text-xs", draftMutedTextClassName)}>
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
                                                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground",
                                                    draftRowHoverClassName,
                                                    isActive && draftRowActiveClassName,
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
                                                <span className="min-w-0 truncate font-medium">
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
                                <p className={cn("px-3 py-2 text-xs", draftMutedTextClassName)}>
                                    Select a provider.
                                </p>
                            ) : (
                                <>
                                    <div className="border-b border-border px-3 py-2">
                                        <p className="truncate text-xs font-medium text-foreground">
                                            {activeGroup.providerAccount}
                                        </p>
                                    </div>
                                    <div className="max-h-[14.5rem] overflow-y-auto py-1">
                                        {activeGroup.models.length === 0 ? (
                                            <p className={cn("px-3 py-2 text-xs", draftMutedTextClassName)}>
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
                                                            "flex w-full px-3 py-1.5 text-left text-xs text-foreground",
                                                            draftRowHoverClassName,
                                                            isSelected && draftRowActiveClassName,
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
