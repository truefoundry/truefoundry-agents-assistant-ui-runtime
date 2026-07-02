"use client";

import { useState } from "react";
import {
    MessagePrimitive,
    useToolCallElapsed,
    type ToolApprovalOption as AuiToolApprovalOption,
    type ToolApprovalResponse,
    type ToolCallMessagePartComponent,
    type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { useTrueFoundryRespondToToolApproval } from "truefoundry-agents-assistant-ui-runtime";

import { useSlot } from "../theme/SlotsProvider.js";
import type { ToolApprovalOption } from "../atoms/ToolApprovalBar.js";
import type { ToolCallStatus } from "../atoms/ToolCallCard.js";
import { NestedApprovalBridgeContext, useNestedApprovalBridge } from "./nestedApprovalBridge.js";

const SUB_AGENT_TOOL_NAME = "create_sub_agent";

const APPROVAL_OPTION_DEFAULT_LABELS: Record<string, string> = {
    "allow-once": "Allow",
    "allow-always": "Always allow",
    "reject-once": "Deny",
    "reject-always": "Always deny",
};

const isAllowKind = (kind: string) => kind === "allow-once" || kind === "allow-always";

function hasPendingToolApproval(approval: { approved?: boolean; resolution?: "cancelled" | "expired" } | undefined) {
    return approval != null && approval.approved === undefined && approval.resolution === undefined;
}

function buildApprovalOptions(options: readonly AuiToolApprovalOption[] | undefined): ToolApprovalOption[] {
    const declared = options?.filter((o) => Object.hasOwn(APPROVAL_OPTION_DEFAULT_LABELS, o.kind));
    if (declared && declared.length > 0) {
        const allow = declared.filter((o) => isAllowKind(o.kind));
        const reject = declared.filter((o) => !isAllowKind(o.kind));
        const mapped: ToolApprovalOption[] = [...allow, ...reject].map((o) => ({
            id: o.id,
            label: o.label ?? APPROVAL_OPTION_DEFAULT_LABELS[o.kind] ?? o.id,
            isAllow: isAllowKind(o.kind),
            grants: o.grants,
            confirm:
                o.confirm != null ? (typeof o.confirm === "object" ? o.confirm : {}) : undefined,
        }));
        if (reject.length === 0) {
            mapped.push({ id: "__deny", label: "Deny", isAllow: false });
        }
        return mapped;
    }
    return [
        { id: "__allow", label: "Allow", isAllow: true },
        { id: "__deny", label: "Deny", isAllow: false },
    ];
}

function formatDuration(ms: number): string {
    if (ms < 1000) return "<1s";
    const seconds = ms / 1000;
    if (seconds < 10) return `${(Math.floor(seconds * 10) / 10).toFixed(1)}s`;
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

function toStatus(statusType: string | undefined): ToolCallStatus {
    if (statusType === "complete") return "success";
    if (statusType === "incomplete") return "error";
    return "running";
}

function ToolApprovalSlot({ part }: { part: ToolCallMessagePartProps }) {
    const ToolApprovalBar = useSlot("ToolApprovalBar");
    const nestedBridge = useNestedApprovalBridge();

    const respond = (response: ToolApprovalResponse) => {
        if (nestedBridge) {
            nestedBridge(response);
            return;
        }
        part.respondToApproval(response);
    };

    const onSelectOption = (optionId: string) => {
        if (optionId === "__allow") return respond({ approved: true });
        if (optionId === "__deny") return respond({ approved: false });
        return respond({ optionId });
    };

    return <ToolApprovalBar options={buildApprovalOptions(part.approval?.options)} onSelectOption={onSelectOption} />;
}

export const ToolCallContainer: ToolCallMessagePartComponent = (part) => {
    const ToolCallCard = useSlot("ToolCallCard");
    const respondToNestedApproval = useTrueFoundryRespondToToolApproval();
    const elapsedMs = useToolCallElapsed();
    const isRequiresAction = part.status?.type === "requires-action";
    const [expanded, setExpanded] = useState(isRequiresAction);
    const [prevRequiresAction, setPrevRequiresAction] = useState(isRequiresAction);
    if (isRequiresAction !== prevRequiresAction) {
        setPrevRequiresAction(isRequiresAction);
        if (isRequiresAction) setExpanded(true);
    }

    const showApproval = isRequiresAction && hasPendingToolApproval(part.approval);
    const isSubAgent = part.toolName === SUB_AGENT_TOOL_NAME;

    const durationText = elapsedMs === undefined ? undefined : formatDuration(elapsedMs);
    const status = toStatus(part.status?.type);

    if (isSubAgent) {
        const firstNested = part.messages?.[0];
        const subAgent = (firstNested?.metadata?.custom as { subAgent?: { title?: string; name?: string; input?: string } } | undefined)
            ?.subAgent;
        const agentName = subAgent?.title ?? subAgent?.name ?? part.toolName;
        const instruction = subAgent?.input ?? "";
        const stepCount = part.messages?.length ?? 0;

        const bridge = (response: ToolApprovalResponse) => {
            if (part.approval == null) return;
            const approved = "approved" in response ? response.approved : undefined;
            if (approved === undefined) return;
            respondToNestedApproval({ approvalId: part.approval.id, approved });
        };

        return (
            <ToolCallCard
                variant="sub-agent"
                name={part.toolName}
                status={status}
                expanded={expanded}
                onToggle={() => setExpanded((prev) => !prev)}
                durationText={durationText}
                agentName={agentName}
                instruction={instruction}
                stepCount={stepCount}
            >
                <NestedApprovalBridgeContext.Provider value={bridge}>
                    <MessagePrimitive.Root data-role="assistant">
                        <MessagePrimitive.Parts components={{ tools: { Fallback: ToolCallContainer } }} />
                    </MessagePrimitive.Root>
                </NestedApprovalBridgeContext.Provider>
            </ToolCallCard>
        );
    }

    return (
        <ToolCallCard
            variant="tool"
            name={part.toolName}
            status={status}
            expanded={expanded}
            onToggle={() => setExpanded((prev) => !prev)}
            durationText={durationText}
            argsText={part.argsText}
            result={
                part.result === undefined
                    ? undefined
                    : typeof part.result === "string"
                      ? part.result
                      : JSON.stringify(part.result, null, 2)
            }
            isError={part.isError}
            approvalSlot={showApproval ? <ToolApprovalSlot part={part} /> : undefined}
        />
    );
};
