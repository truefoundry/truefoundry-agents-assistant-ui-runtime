import { cn } from "@/lib/utils";

/** Shared draft composer surfaces aligned with Gateway Figma tokens. */
export const draftShellClassName = cn(
    "flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-3 text-card-foreground",
    "shadow-none dark:shadow-none",
);

export const draftInputClassName = cn(
    "aui-composer-input max-h-32 min-h-5 w-full resize-none bg-transparent text-base leading-5 outline-none",
    "text-foreground placeholder:text-[var(--composer-placeholder)]",
);

export const draftPillClassName = cn(
    "flex h-6 items-center gap-1 rounded-2xl px-1.5 text-xs font-medium text-foreground",
    "hover:bg-accent/60 data-[state=open]:bg-accent/60",
);

export const draftPanelClassName = cn(
    "border border-border bg-popover text-popover-foreground",
    "shadow-[0px_2px_3px_rgba(0,52,102,0.06),0px_8px_10px_rgba(0,52,102,0.1)]",
    "dark:shadow-[0px_2px_3px_rgba(31,31,34,0.06),0px_8px_10px_rgba(31,31,34,0.1)]",
);

export const draftMenuClassName = cn(draftPanelClassName, "rounded-lg");

export const draftPopoverPanelClassName = cn(
    draftPanelClassName,
    "z-50 overflow-hidden rounded-lg",
);

export const draftSearchClassName = cn(
    "flex w-full items-center gap-1.5 rounded border border-border bg-muted px-1.5 py-2 text-xs",
);

export const draftChipClassName = cn(
    "border border-border bg-muted text-xs font-medium text-foreground",
);

export const draftMenuItemClassName = cn(
    "flex w-full cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-foreground outline-none select-none",
    "hover:bg-accent/60 focus-visible:bg-accent/60",
);

export const draftMenuSectionClassName = cn(
    "px-2 py-1 text-[11px] font-medium tracking-tight text-muted-foreground uppercase",
);

export const draftRowHoverClassName = "hover:bg-accent/60 focus-visible:bg-accent/60";

export const draftRowActiveClassName = "bg-accent/60";

export const draftIconClassName = "text-muted-foreground";

export const draftMutedTextClassName = "text-muted-foreground";

export const draftDividerClassName = "border-border";

export const draftSendButtonClassName = cn(
    "flex size-6 shrink-0 items-center justify-center rounded-full p-1",
    "bg-primary text-primary-foreground shadow-sm",
    "disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
);

export const draftCancelButtonClassName = cn(
    "flex h-6 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
    "bg-primary text-primary-foreground shadow-sm",
    "disabled:opacity-70",
);

export const draftTriggerButtonClassName = cn(
    "size-6 rounded-2xl p-1.5 hover:bg-accent/60 data-[state=open]:bg-accent/60",
);

export const draftCheckboxClassName = cn(
    "flex size-4 shrink-0 items-center justify-center rounded-[2px] border border-border bg-background",
    "shadow-sm",
);

export const draftCheckboxCheckedClassName = "border-primary bg-primary";

export const draftConnectButtonClassName = cn(
    "shrink-0 rounded-[2px] border border-border bg-background px-2 py-1",
    "text-xs font-medium text-foreground shadow-sm",
    "hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-50",
);
