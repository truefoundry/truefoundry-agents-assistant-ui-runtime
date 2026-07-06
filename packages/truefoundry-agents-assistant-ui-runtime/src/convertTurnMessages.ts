import type {
    AppendMessage,
    CompleteAttachment,
    ExportedMessageRepositoryItem,
    MessageStatus,
    ThreadMessage,
    ThreadUserMessagePart,
} from "@assistant-ui/core";
import type {
    AgentSession,
    McpAuthRequiredEvent,
    Turn,
    TurnEvent,
    TurnInputItem,
    TurnStreamData,
} from "truefoundry-gateway-sdk/agents";

import { ROOT_THREAD_ID } from "./constants.js";
import {
    buildRootAssistantContent,
    buildRootAssistantContentForIds,
    findFirstPendingApprovalThreadId,
    findFirstPendingResponseThreadId,
    ingestStreamEvent,
    ingestTurnEvent,
    PeerThreadFoldState,
} from "./foldPeerThreads.js";
import {
    appendMcpAuthToTurnContent,
    appendToolApprovalToTurnContent,
} from "./turnEventHelpers.js";
import type { AssistantContentPart } from "./modelMessageContent.js";
import {
    extractImageUrlFromUserContentItem,
    imageUrlToAttachment,
} from "./modelMessageImageContent.js";
import {
    type SessionSnapshot,
    type ProjectSessionMessagesOptions,
    type SessionTurnRecord,
    type RequiredActionsOverlay,
    createEmptySessionSnapshot,
    emptyRequiredActionsOverlay,
    replaceSessionSnapshot,
    turnToSessionRecord,
} from "./sessionSnapshot.js";
import {
    applyApprovalDecisionsToContent,
    collectApprovalDecisionsFromTurnInput,
    collectSubsequentApprovalDecisions,
    messageHasPendingApprovals,
    TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY,
    toolApprovalMessageCustom,
    toolApprovalStatus,
} from "./toolApproval.js";
import {
    applyStagedResponsesToContent,
    applyUserToolResponsesToFold,
    collectSubsequentToolResponses,
    collectToolResponsesFromTurnInput,
    messageHasPendingResponses,
    TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY,
    toolResponseMessageCustom,
    toolResponseStatus,
} from "./toolResponse.js";
import type { TurnStreamUpdate } from "./turnStreamUpdate.js";
import {
    buildMcpAuthTextParts,
    mcpAuthAssistantStatus,
    mcpAuthMessageCustom,
} from "./mcpAuth.js";

/**
 * Turn / event → assistant-ui normalization
 *
 * This module is the projection layer: it turns gateway session state into
 * `ThreadMessage[]` for `@assistant-ui/core`. The hook in
 * `useTrueFoundryAgentMessages.ts` owns the mutable `SessionSnapshot`; this
 * file defines how that snapshot is built and rendered.
 *
 * ## Data model
 *
 * Gateway side:
 * - A **session** has ordered **turns** (each with `input`, `state`, `listEvents`).
 * - A turn's **input** is either a user message (`user.message`) or a continuation
 *   (`user.tool_response`, `user.tool_approval`, …).
 * - **Events** (`model.message`, `tool.*`, `thread.created`, …) arrive on a
 *   **thread id**; the root conversation uses `ROOT_THREAD_ID` (`"main"`).
 *
 * Local side (`SessionSnapshot` in `sessionSnapshot.ts`):
 * - `fold` — accumulated events across all threads (see `foldPeerThreads.ts`).
 * - `turns` — committed turn records, each optionally storing
 *   `rootModelMessageIds` (root-thread `model.message` ids ingested with that turn).
 * - `pendingUser` / `activeStream` — optimistic UI while a turn is in flight.
 * - `groupRootBaseline` — root `model.message` ids that existed before the active
 *   turn group started; used to scope live streaming to the current group only.
 * - `requiredActions` — locally staged approval/response decisions before resume.
 *
 * Output:
 * - Alternating **user** / **assistant** `ThreadMessage` pairs.
 * - One assistant message per **turn group** (user turn + its continuation turns).
 *
 * ## Turn groups
 *
 * A **turn group** starts at a turn whose input contains `user.message`. Later
 * turns with only continuation inputs (tool response, tool approval, MCP resume)
 * belong to the same group and are folded into the same assistant message.
 *
 * Root content for a group is the union of `rootModelMessageIds` on every turn
 * in that group. Prior groups must not leak in: scope with
 * `rootModelMessageIdsSinceBaseline(fold, baseline)` where
 * `baseline = groupRootBaseline ?? computeGroupRootBaseline(turns)`.
 *
 * ## Pipeline
 *
 * 1. **Ingest** — `ingestStreamEvent` / `ingestTurnEvent` append events into
 *    per-thread buckets in `PeerThreadFoldState`. Deltas merge in place.
 *
 * 2. **Fold to content** — `buildRootAssistantContentForIds` walks scoped
 *    `model.message` ids and emits assistant-ui parts (reasoning, text, tool-call).
 *    Sub-agent child threads are attached under `create_sub_agent` tool-calls as
 *    nested `messages` (see `attachSubAgentMessages` in `foldPeerThreads.ts`).
 *
 * 3. **History projection** — `projectHistoryTurns` walks committed `turns`:
 *    - User turn → push user message; push assistant if the group has content.
 *    - Continuation turn → merge assistant content into the last assistant message
 *      in the group (same `*-assistant` id as the user turn that opened the group).
 *    - Apply answers from later continuation turns onto earlier tool-calls via
 *      `collectSubsequentApprovalDecisions` / `collectSubsequentToolResponses`.
 *    - A paused group's assistant message keeps `requires-action` until a later
 *      continuation turn resolves all its approvals/responses, then downgrades
 *      to the turn-state status (`complete`, `error`, `cancelled`).
 *
 * 4. **Live projection** — `projectSessionMessages` = history + `pendingUser` +
 *    `activeStream`. While streaming, `streamTurnEvents` yields content scoped to
 *    `groupRootBaseline`. When `streamComplete`, `projectActiveStreamUpdate`
 *    rebuilds from the fold (same baseline scoping as streaming).
 *
 * 5. **Staged overlay** — Before the SDK resume turn is sent, user decisions sit
 *    in `requiredActions` and are merged onto messages by
 *    `applyRequiredActionsOverlayToMessages` so the UI shows interrupt + result
 *    together. Resume is batched: all pending approvals and ask-user answers in
 *    a paused message must be resolved before `sendTurn({ inputs })`.
 *
 * ## Required actions (assistant-ui mapping)
 *
 * | Gateway event / input        | assistant-ui representation                          |
 * |-----------------------------|------------------------------------------------------|
 * | `tool.approval_required`    | `tool-call` with `approval: { id }`, status          |
 * |                             | `requires-action` / `tool-calls`, custom thread id   |
 * | `user.tool_approval`        | closes `tool.approval_required`: sets `approval.approved` |
 * |                             | (+ optional reason) on tool-call                       |
 * | `tool.response_required`    | `tool-call` with `interrupt: { type: "human", … }`   |
 * | (ask_user_question)         | payload parsed from tool args (`askUserQuestion.ts`)   |
 * | `user.tool_response`        | closes `tool.response_required`: sets `result` on      |
 * |                             | tool-call and clears the pending `interrupt`           |
 * | `mcp.auth_required`         | Appended auth link text parts; status `interrupt`     |
 *
 * Sub-agent threads can have their own pending approval/response; metadata
 * `toolApprovalThreadId` / `toolResponseThreadId` on nested assistant messages
 * scopes resume inputs to the correct thread.
 *
 * A sub-agent stays attached under the `create_sub_agent` tool-call that spawned
 * it, which lives in the root `model.message` of the turn that opened the group.
 * The child thread keeps producing events across several turns (spawn turn, then
 * continuation turns that answer its required actions), and all of them render
 * under that single tool-call in the group's one assistant message.
 *
 * INVARIANT — while a sub-agent is active the parent agent is paused awaiting a
 * required action, so every following turn until it finishes is a continuation
 * (`user.tool_response` / `user.tool_approval` / MCP resume), NOT a `user.message`.
 * If a sub-agent is spawned/active in turn 1, turn 2 cannot carry `user.message`
 * input. A `user.message` there would open a new turn group (`userText` boundary)
 * and split the still-running sub-agent's events away from its tool-call. The
 * gateway enforces this; the projection relies on it for correct nesting.
 *
 * ## Assumptions
 *
 * - Root-thread model messages use `threadId === ROOT_THREAD_ID`.
 * - Turn order in `snapshot.turns` matches gateway chronological order.
 * - `rootModelMessageIds` on committed turns is accurate (set in
 *   `commitActiveStream` when a stream completes).
 * - Continuation turns never carry `user.message`; that boundary defines groups.
 *   In particular, while a sub-agent (or any tool) is mid-flight awaiting a
 *   required action, the next turn is always a continuation, never a new
 *   `user.message`.
 * - Tool-call identity is stable via `toolCallId` across events, fold state, and
 *   assistant-ui parts.
 * - Reload (`buildSnapshotFromSession`) and live paths must produce the same
 *   per-group scoping; history uses cumulative `groupRootIds` per turn index,
 *   live uses `groupRootBaseline`.
 */

const TURN_EVENTS_PAGE_SIZE = 25;

export type ConvertTurnsResult = {
    messages: ThreadMessage[];
    foldState: PeerThreadFoldState;
    runningTurn?: Turn;
    unstable_resume?: boolean;
};

function assistantStatusFromTurnState(state: Turn["state"]): MessageStatus {
    switch (state.status) {
        case "done":
            return { type: "complete", reason: "stop" };
        case "error":
            return { type: "incomplete", reason: "error", error: state.message };
        case "cancelled":
            return { type: "incomplete", reason: "cancelled" };
        case "running":
            return { type: "running" };
        default:
            return { type: "complete", reason: "unknown" };
    }
}

function resolveCreatedAt(
    messageId: string,
    fallback: Date,
    options?: ProjectSessionMessagesOptions,
): Date {
    return options?.getCreatedAt?.(messageId, fallback) ?? fallback;
}

function parseDataUriMime(data: string): string {
    if (!data.startsWith("data:")) {
        return "application/octet-stream";
    }
    const match = /^data:([^;,]+)/.exec(data);
    return match?.[1] ?? "application/octet-stream";
}

function fileContentToAttachment(
    file: FileContent,
    attachmentId: string,
): CompleteAttachment {
    const mimeType = parseDataUriMime(file.data);
    if (mimeType.startsWith("image/")) {
        return {
            id: attachmentId,
            type: "image",
            name: file.name,
            contentType: mimeType,
            status: { type: "complete" },
            content: [{ type: "image", image: file.data, filename: file.name }],
        };
    }
    return {
        id: attachmentId,
        type: "file",
        name: file.name,
        contentType: mimeType,
        status: { type: "complete" },
        content: [
            {
                type: "file",
                mimeType,
                filename: file.name,
                data: file.data,
            },
        ],
    };
}

/** Projects gateway turn input onto an assistant-ui user message (text + attachments). */
export function buildUserMessageFromTurnInput(
    turnId: string,
    input: Turn["input"],
    createdAt: string | Date,
    options?: ProjectSessionMessagesOptions,
): ThreadMessage {
    const fallback = createdAt instanceof Date ? createdAt : new Date(createdAt);
    const id = `${turnId}-user`;
    const content: ThreadUserMessagePart[] = [];
    const attachments: CompleteAttachment[] = [];

    for (const item of input ?? []) {
        if (item.type !== "user.message") {
            continue;
        }
        const messageContent = item.content;
        if (typeof messageContent === "string") {
            content.push({ type: "text", text: messageContent });
            continue;
        }
        for (const part of messageContent) {
            if (part.type === "text") {
                content.push({ type: "text", text: part.text });
            } else if (part.type === "file") {
                attachments.push(
                    fileContentToAttachment(
                        part,
                        `${turnId}-file-${attachments.length}`,
                    ),
                );
            } else {
                const imageUrl = extractImageUrlFromUserContentItem(part);
                if (imageUrl != null) {
                    attachments.push(
                        imageUrlToAttachment(
                            imageUrl,
                            `${turnId}-file-${attachments.length}`,
                        ),
                    );
                }
            }
        }
    }

    return {
        id,
        role: "user",
        content: content.length > 0 ? content : [{ type: "text", text: "" }],
        attachments,
        createdAt: resolveCreatedAt(id, fallback, options),
        metadata: { custom: {} },
    };
}

function buildAssistantMessage(
    turnId: string,
    content: AssistantContentPart[],
    createdAt: string | Date,
    status: MessageStatus,
    custom: Record<string, unknown> = {},
    options?: ProjectSessionMessagesOptions,
): ThreadMessage {
    const fallback = createdAt instanceof Date ? createdAt : new Date(createdAt);
    const id = `${turnId}-assistant`;
    return {
        id,
        role: "assistant",
        content,
        status,
        createdAt: resolveCreatedAt(id, fallback, options),
        metadata: {
            unstable_state: null,
            unstable_annotations: [],
            unstable_data: [],
            steps: [],
            custom,
        },
    };
}

async function ingestTurnEventsIntoFold(
    foldState: PeerThreadFoldState,
    turn: Pick<Turn, "listEvents">,
): Promise<void> {
    for await (const event of await turn.listEvents({
        order: "asc",
        limit: TURN_EVENTS_PAGE_SIZE,
    })) {
        ingestTurnEvent(foldState, event);
    }
}

async function fetchTurnEvents(
    turn: Pick<Turn, "listEvents">,
): Promise<TurnEvent[]> {
    const events: TurnEvent[] = [];
    for await (const event of await turn.listEvents({
        order: "asc",
        limit: TURN_EVENTS_PAGE_SIZE,
    })) {
        events.push(event);
    }
    return events;
}

function ingestCollectedEventsIntoFold(
    foldState: PeerThreadFoldState,
    events: TurnEvent[],
): void {
    for (const event of events) {
        ingestTurnEvent(foldState, event);
    }
}

async function fetchAllTurnEventsWithConcurrency(
    turns: Turn[],
    concurrency: number,
): Promise<TurnEvent[][]> {
    const results: TurnEvent[][] = new Array(turns.length);
    const pool = new Set<Promise<void>>();
    for (let i = 0; i < turns.length; i++) {
        const idx = i;
        const turn = turns[idx]!;
        const p: Promise<void> = fetchTurnEvents(turn).then((events) => {
            results[idx] = events;
            pool.delete(p);
        });
        pool.add(p);
        if (pool.size >= concurrency) await Promise.race(pool);
    }
    await Promise.all(pool);
    return results;
}

export function rootModelMessageIdsSinceBaseline(
    foldState: PeerThreadFoldState,
    baseline: readonly string[],
): string[] {
    const bucket = foldState.threads.get(ROOT_THREAD_ID);
    if (bucket == null) {
        return [];
    }
    if (baseline.length === 0) {
        return [...bucket.modelMessageIds];
    }
    const baselineSet = new Set(baseline);
    return bucket.modelMessageIds.filter((id) => !baselineSet.has(id));
}

export function computeGroupRootBaseline(turns: SessionTurnRecord[]): string[] {
    let groupStartIndex = turns.length - 1;
    while (groupStartIndex >= 0 && turns[groupStartIndex]?.userText == null) {
        groupStartIndex--;
    }
    const baseline: string[] = [];
    for (let i = 0; i < groupStartIndex; i++) {
        baseline.push(...(turns[i]?.rootModelMessageIds ?? []));
    }
    return baseline;
}

function buildTurnUpdateFromFold(
    foldState: PeerThreadFoldState,
    turn: Pick<Turn, "state">,
    rootModelMessageIds: readonly string[],
): TurnStreamUpdate {
    const content = buildRootAssistantContentForIds(foldState, rootModelMessageIds);
    let update: TurnStreamUpdate = { content };
    update = appendMcpAuthToTurnContent(update.content, turn);
    update = appendToolApprovalToTurnContent(update, turn);
    return update;
}

function contentHasPendingRequiredActions(
    content: readonly AssistantContentPart[],
): boolean {
    const message: ThreadMessage = {
        id: "pending-check",
        role: "assistant",
        content,
        status: { type: "complete", reason: "stop" },
        createdAt: new Date(),
        metadata: {
            unstable_state: null,
            unstable_annotations: [],
            unstable_data: [],
            steps: [],
            custom: {},
        },
    };
    return messageHasPendingApprovals(message) || messageHasPendingResponses(message);
}

function resolveProjectedRequiredActionState(
    turnUpdate: TurnStreamUpdate,
    content: readonly AssistantContentPart[],
    record: Pick<Turn, "state">,
): { status: MessageStatus; custom: Record<string, unknown> } {
    let status = turnUpdate.status ?? assistantStatusFromTurnState(record.state);
    let custom = { ...(turnUpdate.metadata?.custom ?? {}) };

    if (
        status.type === "requires-action" &&
        status.reason === "tool-calls" &&
        !contentHasPendingRequiredActions(content)
    ) {
        status = assistantStatusFromTurnState(record.state);
        const {
            [TOOL_APPROVAL_THREAD_ID_CUSTOM_KEY]: _approvalThreadId,
            [TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY]: _responseThreadId,
            ...restCustom
        } = custom;
        custom = restCustom;
    }

    return { status, custom };
}

function projectActiveStreamUpdate(snapshot: SessionSnapshot): TurnStreamUpdate {
    const activeStream = snapshot.activeStream;
    if (activeStream == null) {
        throw new Error("projectActiveStreamUpdate requires an active stream");
    }

    const hasStagedOverlay =
        snapshot.requiredActions.approvals.size > 0 ||
        snapshot.requiredActions.toolResponses.size > 0;

    // While the user has staged a response locally, keep the paused stream update
    // so required-action collection can pair interrupt + result before resume.
    if (hasStagedOverlay) {
        return activeStream.update;
    }

    const baseline =
        snapshot.groupRootBaseline ?? computeGroupRootBaseline(snapshot.turns);
    const rootModelMessageIds = rootModelMessageIdsSinceBaseline(
        snapshot.fold,
        baseline,
    );

    const foldContent = buildRootAssistantContentForIds(
        snapshot.fold,
        rootModelMessageIds,
    );
    const content =
        foldContent.length > 0 ? foldContent : activeStream.update.content;

    const turnRecord = snapshot.turns.find((turn) => turn.id === activeStream.turnId);
    const turnLike = turnRecord ?? snapshot.runningTurn;

    const rebuilt =
        turnLike != null
            ? buildTurnUpdateFromFold(snapshot.fold, turnLike, rootModelMessageIds)
            : { content };

    return {
        ...activeStream.update,
        content,
        metadata: rebuilt.metadata ?? activeStream.update.metadata,
        status: rebuilt.status ?? activeStream.update.status,
    };
}

function applyRequiredActionsOverlayToMessages(
    messages: ThreadMessage[],
    overlay: RequiredActionsOverlay,
): ThreadMessage[] {
    if (overlay.approvals.size === 0 && overlay.toolResponses.size === 0) {
        return messages;
    }

    return messages.map((message) => {
        if (message.role !== "assistant") {
            return message;
        }

        let { content } = message;
        if (overlay.approvals.size > 0) {
            content = applyApprovalDecisionsToContent(content, overlay.approvals);
        }
        if (overlay.toolResponses.size > 0) {
            content = applyStagedResponsesToContent(content, overlay.toolResponses);
        }

        if (content === message.content) {
            return message;
        }

        return { ...message, content: [...content] };
    });
}

function projectHistoryTurns(
    snapshot: SessionSnapshot,
    options?: ProjectSessionMessagesOptions,
): ThreadMessage[] {
    const messages: ThreadMessage[] = [];
    let lastAssistantIndex: number | undefined;
    let groupRootIds: string[] = [];

    for (let turnIndex = 0; turnIndex < snapshot.turns.length; turnIndex++) {
        const record = snapshot.turns[turnIndex]!;
        const turnRootIds = record.rootModelMessageIds ?? [];

        if (record.userText) {
            groupRootIds = [...turnRootIds];
        } else {
            groupRootIds = [...groupRootIds, ...turnRootIds];
        }

        const turnUpdate = buildTurnUpdateFromFold(snapshot.fold, record, groupRootIds);
        let content = turnUpdate.content;

        const subsequentDecisions = collectSubsequentApprovalDecisions(
            snapshot.turns,
            turnIndex,
        );
        if (subsequentDecisions.size > 0) {
            content = applyApprovalDecisionsToContent(content, subsequentDecisions);
        }

        const subsequentResponses = collectSubsequentToolResponses(
            snapshot.turns,
            turnIndex,
        );
        if (subsequentResponses.size > 0) {
            content = applyStagedResponsesToContent(content, subsequentResponses);
        }

        const currentResponses = collectToolResponsesFromTurnInput(record.input);
        if (currentResponses.size > 0) {
            content = applyStagedResponsesToContent(content, currentResponses);
        }

        const currentDecisions = collectApprovalDecisionsFromTurnInput(record.input);
        if (currentDecisions.size > 0) {
            content = applyApprovalDecisionsToContent(content, currentDecisions);
        }

        const { status, custom: baseCustom } = resolveProjectedRequiredActionState(
            turnUpdate,
            content,
            record,
        );
        const custom =
            record.sandboxId != null ? { ...baseCustom, sandboxId: record.sandboxId } : baseCustom;

        if (record.userText) {
            messages.push(
                buildUserMessageFromTurnInput(
                    record.id,
                    record.input,
                    record.createdAt,
                    options,
                ),
            );

            if (record.state.status === "running") {
                if (content.length > 0) {
                    messages.push(
                        buildAssistantMessage(
                            record.id,
                            content,
                            record.createdAt,
                            status,
                            custom,
                            options,
                        ),
                    );
                    lastAssistantIndex = messages.length - 1;
                }
                break;
            }

            if (content.length > 0) {
                messages.push(
                    buildAssistantMessage(
                        record.id,
                        content,
                        record.createdAt,
                        status,
                        custom,
                        options,
                    ),
                );
                lastAssistantIndex = messages.length - 1;
            }
        } else if (content.length > 0 && lastAssistantIndex != null) {
            if (record.state.status === "running") {
                break;
            }
            const existing = messages[lastAssistantIndex] as Extract<
                ThreadMessage,
                { role: "assistant" }
            >;
            messages[lastAssistantIndex] = {
                ...existing,
                content,
                status,
                metadata: {
                    ...existing.metadata,
                    custom,
                },
            };
        } else if (record.state.status === "running") {
            break;
        }
    }

    return messages;
}

export function projectSessionMessages(
    snapshot: SessionSnapshot,
    options?: ProjectSessionMessagesOptions,
): ThreadMessage[] {
    let messages = projectHistoryTurns(snapshot, options);

    if (snapshot.pendingUser != null) {
        messages.push(
            buildUserMessageFromTurnInput(
                snapshot.pendingUser.turnId,
                [{ type: "user.message", content: snapshot.pendingUser.content }],
                snapshot.pendingUser.createdAt,
                options,
            ),
        );
    }

    if (snapshot.activeStream != null) {
        const { turnId, update, isContinuation, streamComplete } =
            snapshot.activeStream;
        const resolvedUpdate =
            streamComplete === true ? projectActiveStreamUpdate(snapshot) : update;

        const last = messages.at(-1);
        const existingAssistant =
            isContinuation && last?.role === "assistant" ? last : undefined;
        let assistantMessage = turnStreamUpdateToAssistantMessage(
            turnId,
            resolvedUpdate,
            existingAssistant,
            options,
        );
        if (streamComplete === true && resolvedUpdate.status == null) {
            assistantMessage = {
                ...assistantMessage,
                status: { type: "complete", reason: "stop" },
            };
        }

        if (isContinuation && last?.role === "assistant") {
            messages = [...messages.slice(0, -1), assistantMessage];
        } else {
            messages = [...messages, assistantMessage];
        }
    }

    return applyRequiredActionsOverlayToMessages(
        messages,
        snapshot.requiredActions,
    );
}

const DEFAULT_LIST_EVENTS_CONCURRENCY = 5;

function ingestTurnsIntoSnapshot(
    snapshot: SessionSnapshot,
    turns: Turn[],
    eventArrays: TurnEvent[][],
): Turn | undefined {
    let runningTurn: Turn | undefined;

    for (let i = 0; i < turns.length; i++) {
        const turn = turns[i]!;
        const rootBucket = snapshot.fold.threads.get(ROOT_THREAD_ID);
        const beforeCount = rootBucket?.modelMessageIds.length ?? 0;

        ingestCollectedEventsIntoFold(snapshot.fold, eventArrays[i] ?? []);
        applyUserToolResponsesToFold(snapshot.fold, turn.input ?? []);

        const afterBucket = snapshot.fold.threads.get(ROOT_THREAD_ID);
        const rootModelMessageIds = (afterBucket?.modelMessageIds ?? []).slice(
            beforeCount,
        );

        const sandboxEvent = (eventArrays[i] ?? []).find(
            (event): event is Extract<TurnEvent, { type: "sandbox.created" }> =>
                event.type === "sandbox.created",
        );

        snapshot.turns.push({
            ...turnToSessionRecord(turn),
            rootModelMessageIds,
            ...(sandboxEvent != null ? { sandboxId: sandboxEvent.sandboxId } : {}),
        });

        if (turn.state.status === "running") {
            runningTurn = turn;
            break;
        }
    }

    return runningTurn;
}

export async function buildSnapshotFromSession(
    session: AgentSession,
    concurrency: number = DEFAULT_LIST_EVENTS_CONCURRENCY,
): Promise<SessionSnapshot> {
    const turns: Turn[] = [];
    for await (const turn of await session.listTurns()) {
        turns.push(turn);
    }
    turns.reverse();

    const eventArrays = await fetchAllTurnEventsWithConcurrency(turns, concurrency);

    const snapshot = createEmptySessionSnapshot();
    const runningTurn = ingestTurnsIntoSnapshot(snapshot, turns, eventArrays);

    return replaceSessionSnapshot(snapshot, {
        ...(runningTurn != null
            ? {
                  runningTurn,
                  unstable_resume: true as const,
                  groupRootBaseline: computeGroupRootBaseline(snapshot.turns),
              }
            : {}),
    });
}

/** Rebuilds session state from turns strictly before `beforeTurnId` (excludes that turn). */
export async function buildSnapshotBeforeTurn(
    session: AgentSession,
    beforeTurnId: string,
    concurrency: number = DEFAULT_LIST_EVENTS_CONCURRENCY,
): Promise<SessionSnapshot> {
    const turns: Turn[] = [];
    for await (const turn of await session.listTurns()) {
        turns.push(turn);
    }
    turns.reverse();

    const beforeIndex = turns.findIndex((turn) => turn.id === beforeTurnId);
    if (beforeIndex === -1) {
        throw new Error(`Turn ${beforeTurnId} not found in session`);
    }

    return buildSnapshotBeforeTurnIndex(session, beforeIndex, concurrency, turns);
}

/** Rebuilds session state from the first `turnIndex` gateway turns (excludes that turn). */
export async function buildSnapshotBeforeTurnIndex(
    session: AgentSession,
    turnIndex: number,
    concurrency: number = DEFAULT_LIST_EVENTS_CONCURRENCY,
    orderedTurns?: Turn[],
): Promise<SessionSnapshot> {
    if (turnIndex <= 0) {
        return createEmptySessionSnapshot();
    }

    const turns = orderedTurns ?? (await listSessionTurnsOrdered(session));
    const turnsToInclude = turns.slice(0, turnIndex);
    if (turnsToInclude.length === 0) {
        return createEmptySessionSnapshot();
    }

    const eventArrays = await fetchAllTurnEventsWithConcurrency(
        turnsToInclude,
        concurrency,
    );
    const snapshot = createEmptySessionSnapshot();
    ingestTurnsIntoSnapshot(snapshot, turnsToInclude, eventArrays);
    return snapshot;
}

/** Gateway turn id to branch from when resubmitting at `turnIndex` (null for first turn). */
export async function resolveGatewayBranchPreviousTurnId(
    session: AgentSession,
    turnIndex: number,
    orderedTurns?: Turn[],
): Promise<string | null> {
    if (turnIndex <= 0) {
        return null;
    }
    const turns = orderedTurns ?? (await listSessionTurnsOrdered(session));
    return turns[turnIndex - 1]?.id ?? null;
}

async function listSessionTurnsOrdered(session: AgentSession): Promise<Turn[]> {
    const turns: Turn[] = [];
    for await (const turn of await session.listTurns()) {
        turns.push(turn);
    }
    turns.reverse();
    return turns;
}

export async function buildTurnAssistantContent(
    turn: Pick<Turn, "listEvents" | "state">,
    foldState?: PeerThreadFoldState,
): Promise<AssistantContentPart[]> {
    const state = foldState ?? new PeerThreadFoldState();
    const beforeCount =
        state.threads.get(ROOT_THREAD_ID)?.modelMessageIds.length ?? 0;
    await ingestTurnEventsIntoFold(state, turn);
    const afterIds = state.threads.get(ROOT_THREAD_ID)?.modelMessageIds ?? [];
    const rootModelMessageIds = afterIds.slice(beforeCount);
    return buildTurnUpdateFromFold(state, turn, rootModelMessageIds).content;
}

export async function convertTurnsToThreadMessages(
    session: AgentSession,
): Promise<ConvertTurnsResult> {
    const snapshot = await buildSnapshotFromSession(session);
    const messages = projectSessionMessages(snapshot);

    return {
        messages,
        foldState: snapshot.fold,
        ...(snapshot.runningTurn != null
            ? {
                  runningTurn: snapshot.runningTurn,
                  unstable_resume: true as const,
              }
            : {}),
    };
}

export function getTurnMessageContent(message: AppendMessage): string {
    const parts: string[] = [];
    for (const part of message.content) {
        if (part.type === "text") {
            parts.push(part.text);
        }
    }
    const text = parts.join("\n").trim();
    if (!text) {
        throw new Error("User message must contain text content.");
    }
    return text;
}

/**
 * Gateway `user.message` content (string for text-only, or text/file parts).
 * Derived from SDK `TurnInputItem` so it tracks API changes.
 */
export type UserMessageContent = Extract<
    TurnInputItem,
    { type: "user.message" }
>["content"];

type UserMessageContentItem = Exclude<UserMessageContent, string>[number];
type FileContent = Extract<UserMessageContentItem, { type: "file" }>;
type TextContent = Extract<UserMessageContentItem, { type: "text" }>;

function toFileDataUri(data: string, mimeType: string): string {
    // FileContent expects a data URI (`data:<mime>;base64,<payload>`).
    // Attachment adapters typically already produce one via FileReader.readAsDataURL;
    // only wrap bare base64 payloads.
    if (data.startsWith("data:")) {
        return data;
    }
    return `data:${mimeType};base64,${data}`;
}

function toFileContent(name: string, data: string, mimeType: string): FileContent {
    return {
        type: "file",
        name,
        data: toFileDataUri(data, mimeType),
    };
}

/**
 * Builds the gateway turn input content from a composer message, forwarding
 * attachments as SDK `FileContent` parts. Mirrors how assistant-ui surfaces
 * attachment content on `message.attachments[].content`.
 */
export function buildUserMessageContent(message: AppendMessage): UserMessageContent {
    const contentParts = message.content as readonly ThreadUserMessagePart[];
    const inputParts: (ThreadUserMessagePart & { filename?: string })[] = [
        ...contentParts,
        ...(message.attachments?.flatMap((attachment) =>
            attachment.content.map((part) => ({
                ...part,
                filename: attachment.name,
            })),
        ) ?? []),
    ];

    const items: UserMessageContentItem[] = [];
    for (const part of inputParts) {
        switch (part.type) {
            case "text":
                if (part.text.trim().length > 0) {
                    const textPart: TextContent = { type: "text", text: part.text };
                    items.push(textPart);
                }
                break;
            case "image":
                items.push(
                    toFileContent(part.filename ?? "image", part.image, "image/png"),
                );
                break;
            case "file":
                items.push(
                    toFileContent(
                        part.filename ?? "file",
                        part.data,
                        part.mimeType,
                    ),
                );
                break;
            default:
                break;
        }
    }

    const hasFile = items.some((item): item is FileContent => item.type === "file");
    if (!hasFile) {
        // Text-only: keep the string form and the non-empty invariant.
        return getTurnMessageContent(message);
    }
    return items;
}

/** Derives display text from gateway user-message content (drops file parts). */
export function userMessageContentToText(content: UserMessageContent): string {
    if (typeof content === "string") {
        return content;
    }
    return content
        .filter(
            (item): item is TextContent => item.type === "text",
        )
        .map((item) => item.text)
        .join("\n")
        .trim();
}

/** Strips the `-user` suffix from a projected user message id to recover the turn id. */
export function parseTurnIdFromMessageId(messageId: string): string {
    return messageId.replace(/-user$/, "");
}

/** Parent turn id for branching before `turnId`; `null` when editing the first turn. */
export function resolveBranchPreviousTurnId(
    turns: readonly SessionTurnRecord[],
    turnId: string,
): string | null {
    const turnIndex = turns.findIndex((turn) => turn.id === turnId);
    if (turnIndex <= 0) {
        return null;
    }
    return turns[turnIndex - 1]!.id;
}

/** Extracts edited text from an assistant-ui append message (text parts only). */
export function extractEditedText(message: AppendMessage): string {
    return getTurnMessageContent(message);
}

/** Original gateway user-message content from a turn record (for reset). */
export function extractTurnUserMessageContent(
    input: TurnInputItem[] | undefined,
): UserMessageContent {
    for (const item of input ?? []) {
        if (item.type === "user.message") {
            return item.content;
        }
    }
    return "";
}

/**
 * Builds resubmit content for a text-only edit: replaces text with `editedText`
 * while preserving original file parts from the turn record.
 */
export function buildEditedUserMessageContent(
    editedText: string,
    originalInput: TurnInputItem[] | undefined,
): UserMessageContent {
    const fileParts: FileContent[] = [];
    for (const item of originalInput ?? []) {
        if (item.type !== "user.message") {
            continue;
        }
        const content = item.content;
        if (typeof content === "string") {
            continue;
        }
        for (const part of content) {
            if (part.type === "file") {
                fileParts.push(part);
            }
        }
    }

    if (fileParts.length === 0) {
        return editedText;
    }

    const items: UserMessageContentItem[] = [];
    if (editedText.trim().length > 0) {
        items.push({ type: "text", text: editedText });
    }
    items.push(...fileParts);
    return items;
}

function buildMcpAuthUpdate(
    pendingMcpAuth: McpAuthRequiredEvent,
    foldState: PeerThreadFoldState,
    groupRootBaseline?: readonly string[],
): TurnStreamUpdate {
    const base =
        groupRootBaseline != null
            ? buildRootAssistantContentForIds(
                  foldState,
                  rootModelMessageIdsSinceBaseline(foldState, groupRootBaseline),
              )
            : buildRootAssistantContent(foldState);
    return {
        content: [...base, ...buildMcpAuthTextParts(pendingMcpAuth.mcpServers)],
        status: mcpAuthAssistantStatus(),
        metadata: { custom: mcpAuthMessageCustom(pendingMcpAuth.mcpServers) },
    };
}

export async function* streamTurnEvents(
    stream: AsyncIterable<TurnStreamData>,
    foldState: PeerThreadFoldState,
    groupRootBaseline?: readonly string[],
): AsyncGenerator<TurnStreamUpdate> {
    let pendingMcpAuth: McpAuthRequiredEvent | undefined;
    let sandboxId: string | undefined;
    let sandboxIdYielded = false;

    const withSandbox = (update: TurnStreamUpdate): TurnStreamUpdate => {
        if (sandboxId == null) {
            return update;
        }
        sandboxIdYielded = true;
        return {
            ...update,
            metadata: { ...update.metadata, custom: { ...update.metadata?.custom, sandboxId } },
        };
    };

    const yieldContent = (): AssistantContentPart[] | undefined => {
        const ids =
            groupRootBaseline != null
                ? rootModelMessageIdsSinceBaseline(foldState, groupRootBaseline)
                : foldState.threads.get(ROOT_THREAD_ID)?.modelMessageIds ?? [];
        const content = buildRootAssistantContentForIds(foldState, ids);
        return content.length > 0 ? content : undefined;
    };

    for await (const data of stream) {
        const event = data.event;

        if (event.type === "sandbox.created") {
            sandboxId = event.sandboxId;
            continue;
        }

        if (event.type === "mcp.auth_required") {
            pendingMcpAuth = event;
            continue;
        }

        if (event.type === "turn.done") {
            if (event.state.status === "error") {
                throw new Error(event.state.message);
            }
            // The turn is logically complete once `turn.done` is observed. The
            // resumed-turn transport (`subscribeToTurn`) is a reconnectable live
            // tail and is not guaranteed to close its SSE body right after this
            // event, so we must stop consuming explicitly rather than waiting
            // for the underlying stream to end — otherwise `isRunning` never
            // clears and the composer's cancel/spinner button gets stuck.
            break;
        }

        if (!ingestStreamEvent(foldState, event)) {
            continue;
        }

        const content = yieldContent();
        if (content != null) {
            yield withSandbox({ content });
        }
    }

    if (pendingMcpAuth != null) {
        yield withSandbox(buildMcpAuthUpdate(pendingMcpAuth, foldState, groupRootBaseline));
        return;
    }

    const approvalThreadId = findFirstPendingApprovalThreadId(foldState);
    const responseThreadId = findFirstPendingResponseThreadId(foldState);
    if (approvalThreadId != null || responseThreadId != null) {
        const custom: Record<string, unknown> = {};
        if (approvalThreadId != null) {
            Object.assign(
                custom,
                toolApprovalMessageCustom(
                    approvalThreadId === ROOT_THREAD_ID ? ROOT_THREAD_ID : approvalThreadId,
                ),
            );
        }
        if (responseThreadId != null) {
            Object.assign(
                custom,
                toolResponseMessageCustom(
                    responseThreadId === ROOT_THREAD_ID ? ROOT_THREAD_ID : responseThreadId,
                ),
            );
        }
        const ids =
            groupRootBaseline != null
                ? rootModelMessageIdsSinceBaseline(foldState, groupRootBaseline)
                : foldState.threads.get(ROOT_THREAD_ID)?.modelMessageIds ?? [];
        yield withSandbox({
            content: buildRootAssistantContentForIds(foldState, ids),
            status:
                approvalThreadId != null ? toolApprovalStatus() : toolResponseStatus(),
            metadata: { custom },
        });
        return;
    }

    if (sandboxId != null && !sandboxIdYielded) {
        const ids =
            groupRootBaseline != null
                ? rootModelMessageIdsSinceBaseline(foldState, groupRootBaseline)
                : foldState.threads.get(ROOT_THREAD_ID)?.modelMessageIds ?? [];
        yield withSandbox({ content: buildRootAssistantContentForIds(foldState, ids) });
    }
}

export function turnStreamUpdateToAssistantMessage(
    turnId: string,
    update: TurnStreamUpdate,
    existing?: ThreadMessage,
    options?: ProjectSessionMessagesOptions,
): ThreadMessage {
    const id =
        existing?.role === "assistant"
            ? existing.id
            : `${turnId}-assistant`;
    const fallbackCreatedAt = existing?.createdAt ?? new Date();
    return {
        id,
        role: "assistant",
        content: update.content,
        status: update.status ?? { type: "running" },
        createdAt: resolveCreatedAt(id, fallbackCreatedAt, options),
        metadata: {
            unstable_state: null,
            unstable_annotations: [],
            unstable_data: [],
            steps: [],
            custom: update.metadata?.custom ?? {},
        },
    };
}

export function repositoryItemsFromMessages(
    messages: readonly ThreadMessage[],
): ExportedMessageRepositoryItem[] {
    const items: ExportedMessageRepositoryItem[] = [];
    let parentId: string | null = null;
    for (const message of messages) {
        items.push({ parentId, message });
        parentId = message.id;
    }
    return items;
}

export type { SessionSnapshot, ProjectSessionMessagesOptions } from "./sessionSnapshot.js";
