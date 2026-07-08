import type {
    McpAuthRequiredEvent,
    Turn,
    TurnCreatedEvent,
    TurnDoneEvent,
    TurnInputItem,
} from "truefoundry-gateway-sdk/agents";

import { extractTurnUserText } from "./extractTurnUserText.js";
import { PeerThreadFoldState } from "./foldPeerThreads.js";
import type { StoredApprovalDecision } from "./toolApproval.js";
import type { StoredToolResponse } from "./toolResponse.js";
import type { TurnStreamUpdate } from "./turnStreamUpdate.js";

/** Turn metadata retained for cross-turn projection and subsequent required-action replay. */
export type SessionTurnRecord = Pick<
    Turn,
    "id" | "createdAt" | "state" | "input"
> & {
    /** Denormalized from `input` for user/assistant interleaving during projection. */
    userText?: string;
    /** Root-thread `model.message` ids ingested with this turn (for per-group projection). */
    rootModelMessageIds?: readonly string[];
    /** sandboxId observed via a `sandbox.created` event during this turn (session-scoped, latest wins). */
    sandboxId?: string;
};

export type RequiredActionsOverlay = {
    approvals: Map<string, StoredApprovalDecision>;
    toolResponses: Map<string, StoredToolResponse>;
};

export type ActiveStreamState = {
    turnId: string;
    update: TurnStreamUpdate;
    isContinuation: boolean;
    streamComplete?: boolean;
};

export type PendingUserMessage = {
    turnId: string;
    /** Gateway user.message content (text-only string or text/file parts). */
    content: Extract<TurnInputItem, { type: "user.message" }>["content"];
    createdAt: Date;
};

export type SessionSnapshot = {
    fold: PeerThreadFoldState;
    turns: SessionTurnRecord[];
    pendingMcpAuth?: McpAuthRequiredEvent;
    pendingUser?: PendingUserMessage;
    activeStream?: ActiveStreamState;
    /** Root `model.message` ids present before the active turn group started (streaming scope). */
    groupRootBaseline?: readonly string[];
    requiredActions: RequiredActionsOverlay;
    runningTurn?: Turn;
    unstable_resume?: boolean;
};

export type ProjectSessionMessagesOptions = {
    getCreatedAt?: (messageId: string, fallback: Date) => Date;
};

export function emptyRequiredActionsOverlay(): RequiredActionsOverlay {
    return {
        approvals: new Map(),
        toolResponses: new Map(),
    };
}

export function createEmptySessionSnapshot(): SessionSnapshot {
    return {
        fold: new PeerThreadFoldState(),
        turns: [],
        requiredActions: emptyRequiredActionsOverlay(),
    };
}

export function turnToSessionRecord(turn: Turn): SessionTurnRecord {
    const userText = extractTurnUserText(turn.input);
    return {
        id: turn.id,
        ...(userText ? { userText } : {}),
        createdAt: turn.createdAt,
        state: turn.state,
        input: turn.input,
    };
}

/** Builds a SessionTurnRecord from session-level TurnCreatedEvent + TurnDoneEvent data. */
export function sessionEventsToSessionRecord(
    turnId: string,
    createdEvent: TurnCreatedEvent,
    doneEvent: TurnDoneEvent,
    rootModelMessageIds: readonly string[],
    sandboxId?: string,
): SessionTurnRecord {
    const userText = extractTurnUserText(createdEvent.input);
    return {
        id: turnId,
        ...(userText ? { userText } : {}),
        createdAt: createdEvent.createdAt,
        state: doneEvent.state,
        input: createdEvent.input,
        rootModelMessageIds,
        ...(sandboxId != null ? { sandboxId } : {}),
    };
}

/** Returns a new snapshot wrapper; fold maps may be mutated in place before calling. */
export function replaceSessionSnapshot(
    snapshot: SessionSnapshot,
    patch: Partial<Omit<SessionSnapshot, "fold" | "requiredActions">> & {
        requiredActions?: RequiredActionsOverlay;
    },
): SessionSnapshot {
    return {
        ...snapshot,
        ...patch,
        ...(patch.requiredActions != null
            ? { requiredActions: patch.requiredActions }
            : {}),
    };
}

export function cloneRequiredActionsOverlay(
    overlay: RequiredActionsOverlay,
): RequiredActionsOverlay {
    return {
        approvals: new Map(overlay.approvals),
        toolResponses: new Map(overlay.toolResponses),
    };
}
