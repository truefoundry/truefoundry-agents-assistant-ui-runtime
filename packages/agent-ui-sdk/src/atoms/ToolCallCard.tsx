import type { ComponentType, ReactNode } from "react";
import { BriefcaseIcon, CheckIcon, ChevronDownIcon, LoaderIcon, PlugIcon, WrenchIcon, XCircleIcon } from "lucide-react";

import { cn } from "./lib/cn.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./primitives/Collapsible.js";

export type ToolCallStatus = "running" | "success" | "error";

type ToolCallCardBaseProps = {
    variant: "tool" | "sub-agent" | "mcp-listing";
    name: string;
    status: ToolCallStatus;
    expanded: boolean;
    onToggle: () => void;
    /** Not in the Section 6 screenshot contract; ported from the reference's live per-call timer. */
    durationText?: string;
    className?: string;
};

export type ToolCallCardToolProps = ToolCallCardBaseProps & {
    variant: "tool";
    argsText?: string;
    result?: string;
    isError?: boolean;
    /**
     * Extends the Section 6 contract: renders the pending tool-approval / ask-user
     * UI when this call requires action. The reference screenshots didn't include
     * an in-flight approval state, so this slot was inferred rather than observed.
     */
    approvalSlot?: ReactNode;
};

export type ToolCallCardSubAgentProps = ToolCallCardBaseProps & {
    variant: "sub-agent";
    agentName: string;
    instruction: string;
    stepCount: number;
    children?: ReactNode;
};

export type ToolCallCardMcpProps = ToolCallCardBaseProps & {
    variant: "mcp-listing";
    serverName: string;
    description: string;
    argsText: string;
    resultText: string;
};

export type ToolCallCardProps = ToolCallCardToolProps | ToolCallCardSubAgentProps | ToolCallCardMcpProps;

const variantIcon: Record<ToolCallCardProps["variant"], ComponentType<{ className?: string }>> = {
    tool: WrenchIcon,
    "sub-agent": BriefcaseIcon,
    "mcp-listing": PlugIcon,
};

function StatusIcon({ status }: { status: ToolCallStatus }) {
    if (status === "running") {
        return (
            <LoaderIcon
                data-slot="tool-call-card-status-icon"
                className="text-muted-foreground size-4 shrink-0 animate-spin [animation-duration:0.6s]"
            />
        );
    }
    if (status === "success") {
        return (
            <CheckIcon
                data-slot="tool-call-card-status-icon"
                className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
        );
    }
    return <XCircleIcon data-slot="tool-call-card-status-icon" className="text-destructive size-4 shrink-0" />;
}

function IconChip({ Icon }: { Icon: ComponentType<{ className?: string }> }) {
    return (
        <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-md">
            <Icon className="size-3.5" />
        </span>
    );
}

export function ToolCallCard(props: ToolCallCardProps) {
    const { variant, name, status, expanded, onToggle, durationText, className } = props;
    const VariantIcon = variantIcon[variant];

    return (
        <Collapsible
            data-slot="tool-call-card"
            data-variant={variant}
            open={expanded}
            onOpenChange={onToggle}
            className={cn("aui-tool-call-card w-full rounded-lg border py-2", className)}
        >
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 text-left">
                <IconChip Icon={VariantIcon} />
                {variant === "tool" && <span className="text-sm">{name}</span>}
                {variant === "sub-agent" && (
                    <span className="flex min-w-0 flex-col items-start">
                        <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                            Sub-agent
                        </span>
                        <span className="truncate text-sm font-medium">{props.agentName}</span>
                    </span>
                )}
                {variant === "mcp-listing" && (
                    <span className="truncate text-sm">Listing tools · {props.serverName}</span>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-2">
                    {durationText && (
                        <span className="text-muted-foreground text-xs tabular-nums">{durationText}</span>
                    )}
                    <StatusIcon status={status} />
                    <ChevronDownIcon
                        className={cn(
                            "size-4 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                            expanded ? "rotate-0" : "-rotate-90",
                        )}
                    />
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pt-2">
                {variant === "tool" && (
                    <div className="flex flex-col gap-2">
                        {props.approvalSlot}
                        {props.argsText && (
                            <div>
                                <p className="text-muted-foreground text-xs font-medium">Request:</p>
                                <pre className="bg-muted/50 text-foreground/90 mt-1 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap">
                                    {props.argsText}
                                </pre>
                            </div>
                        )}
                        {props.result !== undefined && (
                            <div>
                                <p className="text-muted-foreground text-xs font-medium">Result:</p>
                                <pre
                                    className={cn(
                                        "bg-muted/50 mt-1 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap",
                                        props.isError ? "text-destructive" : "text-foreground/90",
                                    )}
                                >
                                    {props.result}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
                {variant === "sub-agent" && (
                    <div className="flex flex-col gap-2">
                        <p className="text-muted-foreground line-clamp-2 text-sm">{props.instruction}</p>
                        <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                            Steps · {props.stepCount} steps
                        </p>
                        <div className="border-border/60 flex flex-col gap-2 border-l pl-3">{props.children}</div>
                    </div>
                )}
                {variant === "mcp-listing" && (
                    <div className="flex flex-col gap-2">
                        <p className="text-muted-foreground text-sm">{props.description}</p>
                        <div>
                            <p className="text-muted-foreground text-xs font-medium">Request:</p>
                            <pre className="bg-muted/50 text-foreground/90 mt-1 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap">
                                {props.argsText}
                            </pre>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs font-medium">Result:</p>
                            <pre className="bg-muted/50 text-foreground/90 mt-1 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap">
                                {props.resultText}
                            </pre>
                        </div>
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        ToolCallCard: typeof ToolCallCard;
    }
}
