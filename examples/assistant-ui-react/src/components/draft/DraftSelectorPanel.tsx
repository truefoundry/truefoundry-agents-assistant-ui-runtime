"use client";

import type { ReactNode } from "react";
import { SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export const selectorPanelClassName = cn(
    "relative z-10 bg-white border border-[#e0ecfd] text-[#162235]",
    "flex w-[17.5rem] flex-col gap-1 rounded-lg px-3 py-4",
    "shadow-[0px_2px_3px_rgba(0,52,102,0.06),0px_8px_10px_rgba(0,52,102,0.1)]",
);

export const selectorSearchClassName = cn(
    "flex w-full items-center gap-1.5 rounded border border-[#cee0f8] bg-[#f0f7ff] px-1.5 py-2 text-xs",
);

const selectorRowClassName = cn(
    "flex items-center gap-2 rounded px-2 py-1 text-left outline-none cursor-pointer",
    "hover:bg-[#e8f2fe]/60 focus-visible:bg-[#e8f2fe]/60",
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
            <SearchIcon className="size-3.5 shrink-0 text-[#82a0ce]" />
            <input
                type="search"
                value={value}
                disabled={disabled}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[#5e7baa] outline-none placeholder:text-[#5e7baa]"
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
            <p className="px-2 py-1 text-[11px] font-medium tracking-[-0.22px] text-[#3e5680]">
                {label}
            </p>
            <div className="mx-2 h-px bg-[#e0ecfd]" />
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
        return <p className="px-2 py-2 text-xs text-[#5e7baa]">Loading…</p>;
    }
    if (error) {
        return <p className="px-2 py-2 text-xs text-red-600">{error}</p>;
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
                    "min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                )}
            >
                <span className="flex size-4 shrink-0 items-center justify-center text-[#4d6896]">
                    {icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#162236]">
                    {label}
                </span>
                <span
                    className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[2px] border border-[#cee0f8] bg-white",
                        "shadow-[0px_1px_1px_rgba(0,0,0,0.05)]",
                        checked && "border-[#4d6896] bg-[#4d6896]",
                    )}
                    aria-hidden
                >
                    {checked ? <span className="size-2 rounded-[1px] bg-white" /> : null}
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
            className={cn(
                "shrink-0 rounded-[2px] border border-[#cee0f8] bg-white px-2 py-1",
                "text-xs font-medium text-[#263755] shadow-[0px_1px_1px_rgba(0,0,0,0.05)]",
                "hover:bg-[#e8f2fe]/60 disabled:cursor-not-allowed disabled:opacity-50",
            )}
        >
            {loading ? "…" : "Connect"}
        </button>
    );
}
