"use client";

import type { ReactNode } from "react";
import { SearchIcon } from "lucide-react";

import {
    draftCheckboxCheckedClassName,
    draftCheckboxClassName,
    draftConnectButtonClassName,
    draftDividerClassName,
    draftMutedTextClassName,
    draftPanelClassName,
    draftRowHoverClassName,
    draftSearchClassName,
} from "@/components/draft/draftComposerStyles";
import { cn } from "@/lib/utils";

export const selectorPanelClassName = cn(draftPanelClassName, "relative z-10 flex w-[17.5rem] flex-col gap-1 rounded-lg px-3 py-4");

export const selectorSearchClassName = draftSearchClassName;

export { draftMutedTextClassName } from "@/components/draft/draftComposerStyles";

const selectorRowClassName = cn(
    "flex items-center gap-2 rounded px-2 py-1 text-left outline-none cursor-pointer",
    draftRowHoverClassName,
);

type DraftSelectorSearchProps = {
    value: string;
    placeholder: string;
    disabled?: boolean;
    onChange: (value: string) => void;
};

export function DraftSelectorSearch({
    value,
    placeholder,
    disabled,
    onChange,
}: DraftSelectorSearchProps) {
    return (
        <label className={selectorSearchClassName}>
            <SearchIcon className={cn("size-3.5 shrink-0", draftMutedTextClassName)} />
            <input
                type="search"
                value={value}
                disabled={disabled}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                className={cn(
                    "min-w-0 flex-1 bg-transparent outline-none",
                    draftMutedTextClassName,
                    "placeholder:text-muted-foreground",
                )}
            />
        </label>
    );
}

type DraftSelectorSectionHeaderProps = {
    label: string;
};

export function DraftSelectorSectionHeader({ label }: DraftSelectorSectionHeaderProps) {
    return (
        <>
            <p className={cn("px-2 py-1 text-[11px] font-medium tracking-[-0.22px]", draftMutedTextClassName)}>
                {label}
            </p>
            <div className={cn("mx-2 h-px bg-border")} />
        </>
    );
}

type DraftSelectorListProps = {
    isLoading?: boolean;
    error?: string | null;
    children: ReactNode;
};

export function DraftSelectorList({
    isLoading,
    error,
    children,
}: DraftSelectorListProps) {
    if (isLoading) {
        return <p className={cn("px-2 py-2 text-xs", draftMutedTextClassName)}>Loading…</p>;
    }
    if (error) {
        return <p className="px-2 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>;
    }
    return <div className="flex max-h-56 flex-col overflow-y-auto">{children}</div>;
}

type DraftSelectorRowProps = {
    icon: ReactNode;
    label: string;
    checked: boolean;
    disabled?: boolean;
    trailing?: ReactNode;
    onCheckedChange: (checked: boolean) => void;
};

export function DraftSelectorRow({
    icon,
    label,
    checked,
    disabled,
    trailing,
    onCheckedChange,
}: DraftSelectorRowProps) {
    function handleToggle() {
        if (disabled) return;
        onCheckedChange(!checked);
    }

    return (
        <div className="flex items-center gap-2 rounded px-1 py-0.5">
            <button
                type="button"
                disabled={disabled}
                onClick={handleToggle}
                className={cn(
                    selectorRowClassName,
                    "min-w-0 flex-1 text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                )}
            >
                <span className={cn("flex size-4 shrink-0 items-center justify-center", draftMutedTextClassName)}>
                    {icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
                <span
                    className={cn(
                        draftCheckboxClassName,
                        checked && draftCheckboxCheckedClassName,
                    )}
                    aria-hidden
                >
                    {checked ? (
                        <span className="size-2 rounded-[1px] bg-primary-foreground" />
                    ) : null}
                </span>
            </button>
            {trailing != null ? <div className="shrink-0">{trailing}</div> : null}
        </div>
    );
}

export function DraftSelectorConnectButton({
    disabled,
    loading,
    onClick,
}: {
    disabled?: boolean;
    loading?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled || loading}
            onClick={onClick}
            className={draftConnectButtonClassName}
        >
            {loading ? "…" : "Connect"}
        </button>
    );
}
