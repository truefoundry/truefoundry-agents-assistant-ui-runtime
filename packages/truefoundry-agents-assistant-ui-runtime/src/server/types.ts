/**
 * FE-owned AgentUIServer contract.
 *
 * Rule: only methods/fields the runtime or UI invokes.
 * Hosts extend via `T extends Base` for system-specific extras.
 * No dependency on truefoundry-gateway-sdk.
 */

import type {
    ActionRequiredEvent,
    SessionEventItem,
    TurnEvent,
    TurnStreamData,
    TurnStreamingEvent,
} from "./events.js";

// ---------------------------------------------------------------------------
// Catalog — selector rows (SDK-minimal; host extends via generics)
// ---------------------------------------------------------------------------

/** Model selector row. Host extends for apiModel, modelId, pricing, etc. */
export interface ModelSelectorEntry {
    name: string;
    provider: string;
}

/** Skill selector row. Host extends for fqn, preload, etc. */
export interface SkillSelectorEntry {
    id: string;
    name: string;
    description?: string;
}

/** MCP connector selector row. Host extends for type, enableTools, url, etc. */
export interface ConnectorSelectorEntry {
    id: string;
    name: string;
    description?: string;
}

/** Agent selector row — UI shows name only. Host extends for metadata. */
export interface AgentSelectorEntry {
    name: string;
}

export type SearchAgentSelectorParams = {
    query?: string;
    limit?: number;
    offset?: number;
};

// ---------------------------------------------------------------------------
// Mounts — neutral SDK base (host extends with backend-specific fields)
// ---------------------------------------------------------------------------

/**
 * Mounts written to AgentSpec.skills[] / AgentSpec.mcpServers[].
 *
 * These are opaque to the runtime — it stores and forwards them but never reads
 * a field, and the backend owns the shape (the gateway identifies a skill by
 * `fqn`, with no `id` or `name` anywhere). So the base constrains only that a
 * mount is an object; hosts intersect their concrete mount type over it, as
 * `TfySkillMount` / `TfyMcpServerMount` do in the gateway adapter.
 *
 * Naming a field here would not just be unread, it would be wrong: a base with
 * required fields rejects the backend's own payloads, and one with only optional
 * fields is a weak type, which TypeScript rejects for a source that shares no
 * property with it — the gateway's registry skill shares none.
 */
export type SkillMount = object;

export type McpServerMount = object;

// ---------------------------------------------------------------------------
// AgentSpec — model + skills + mcpServers on base; host widens the rest
// ---------------------------------------------------------------------------

export interface ModelParams {
    maxTokens?: number;
    reasoningEffort?: string;
}

export interface Model {
    name: string;
    params?: ModelParams;
}

/**
 * SDK-owned agent definition — fields the FE reads/writes.
 * Host adds additional fields via `TSpec extends AgentSpec`.
 */
export interface AgentSpec {
    model: Model;
    skills?: SkillMount[];
    mcpServers?: McpServerMount[];
    instructions?: string;
    messages?: unknown[];
    variables?: Record<string, string>;
    responseFormat?: unknown;
    config?: unknown;
}

// ---------------------------------------------------------------------------
// Session — plain DTO, generic in TSpec so host's spec type flows through
// ---------------------------------------------------------------------------

export interface Session<TSpec extends AgentSpec = AgentSpec> {
    id: string;
    title?: string | null;
    agentName?: string | null;
    agentSpec?: TSpec;
    /** true → mutable builder + updateSession(spec) allowed. */
    isMutable: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSessionRequest<TSpec extends AgentSpec = AgentSpec> {
    agentName?: string;
    agentSpec?: TSpec;
    title?: string;
}

export interface UpdateSessionRequest<TSpec extends AgentSpec = AgentSpec> {
    sessionId: string;
    agentSpec?: TSpec;
    title?: string;
}

// ---------------------------------------------------------------------------
// Pagination — flat token-based (no Page objects with methods)
// ---------------------------------------------------------------------------

export interface ListResult<T> {
    data: T[];
    nextPageToken?: string;
}

export type ListSessionsOrder = "asc" | "desc";

export type PageParams = {
    limit?: number;
    order?: ListSessionsOrder;
    pageToken?: string;
};

export interface ListSessionsParams extends PageParams {
    agentName?: string;
    /** Host-specific filter (e.g. TFY startTimestamp). */
    startTimestamp?: string;
}

export type PreviousTurnIdInput = "auto" | string;

// ---------------------------------------------------------------------------
// Turn input / state — what runtime sends and reads
// ---------------------------------------------------------------------------

export type UserMessageContent =
    | string
    | Array<{ type: "text"; text: string } | { type: "file"; name: string; data: string }>;

export interface UserMessage {
    type: "user.message";
    content: UserMessageContent;
}

export type ApprovalDecision =
    | { status: "allow" }
    | { status: "deny"; reason?: string };

export interface UserToolApprovalEvent {
    type: "user.tool_approval";
    threadId: string;
    toolCallId: string;
    approval: ApprovalDecision;
}

export interface UserToolResponseEvent {
    type: "user.tool_response";
    threadId: string;
    toolCallId: string;
    content: string;
}

export type TurnInputItem =
    | UserMessage
    | UserToolApprovalEvent
    | UserToolResponseEvent;

export type TurnStateRunning = { status: "running" };

export type TurnStateDone = {
    status: "done";
    output?: unknown;
    requiredActions?: ActionRequiredEvent[];
    completedAt: string;
};

export type TurnStateCancelled = {
    status: "cancelled";
    reason: string;
    completedAt: string;
};

export type TurnStateError = {
    status: "error";
    message: string;
    completedAt: string;
};

export type TurnState =
    | TurnStateRunning
    | TurnStateDone
    | TurnStateCancelled
    | TurnStateError;

/** Plain turn DTO — no methods. */
export interface Turn {
    id: string;
    sessionId: string;
    previousTurnId?: string | null;
    input?: TurnInputItem[];
    state: TurnState;
    createdAt: string;
}

// ---------------------------------------------------------------------------
// Server ports — flat methods, no session-with-methods objects
// ---------------------------------------------------------------------------

/**
 * Chat / session port — the runtime calls these.
 *
 * All session ops are flat (sessionId param). No gateway client dependency.
 * `createTrueFoundryServer` is one possible implementation (TFY adapter).
 */
export interface AgentChatServer<
    TSpec extends AgentSpec = AgentSpec,
    TSession extends Session<TSpec> = Session<TSpec>,
    TCreate extends CreateSessionRequest<TSpec> = CreateSessionRequest<TSpec>,
    TList extends ListSessionsParams = ListSessionsParams,
    TUpdate extends UpdateSessionRequest<TSpec> = UpdateSessionRequest<TSpec>,
    TTurn extends Turn = Turn,
> {
    createSession(req: TCreate): Promise<TSession>;
    listSessions(req?: TList): Promise<ListResult<TSession>>;
    getSession(req: { sessionId: string }): Promise<TSession>;
    updateSession(req: TUpdate): Promise<TSession>;

    prepareAndExecuteTurn(req: {
        sessionId: string;
        input?: TurnInputItem[];
        previousTurnId?: PreviousTurnIdInput;
        abortSignal?: AbortSignal;
        headers?: Record<string, string>;
    }): AsyncIterable<TurnStreamData>;

    cancelSession(req: { sessionId: string }): Promise<void>;
    deleteSession?(req: { sessionId: string }): Promise<void>;

    listTurns(req: {
        sessionId: string;
        limit?: number;
        pageToken?: string;
        order?: ListSessionsOrder;
    }): Promise<ListResult<TTurn>>;
    getTurn(req: { sessionId: string; turnId: string }): Promise<TTurn>;
    listEvents(req: {
        sessionId: string;
        pageToken?: string;
        lastTurnId?: string;
        limit?: number;
    }): Promise<ListResult<SessionEventItem>>;

    /** Optional per-turn event listing (hydrate in-flight turn content). */
    listTurnEvents?(req: {
        sessionId: string;
        turnId: string;
        limit?: number;
        pageToken?: string;
        order?: ListSessionsOrder;
    }): Promise<ListResult<TurnEvent>>;

    subscribeToTurn?(req: {
        sessionId: string;
        turnId: string;
        afterSequenceNumber?: number;
        abortSignal?: AbortSignal;
    }): AsyncIterable<TurnStreamData>;

    downloadSandboxFile?(
        sandboxId: string,
        req: { path: string },
    ): Promise<Blob>;
}

/**
 * Builder catalog + persist port — atoms call these.
 * Passed separately from the runtime's chat server.
 */
export interface AgentBuilderServer<
    TSpec extends AgentSpec = AgentSpec,
    TModel extends ModelSelectorEntry = ModelSelectorEntry,
    TSkill extends SkillSelectorEntry = SkillSelectorEntry,
    TMcp extends ConnectorSelectorEntry = ConnectorSelectorEntry,
    TAgent extends AgentSelectorEntry = AgentSelectorEntry,
    TSave = unknown,
> {
    getModels(): Promise<TModel[]>;
    getSkills(): Promise<TSkill[]>;
    getMcp(): Promise<TMcp[]>;
    searchAgents(req?: SearchAgentSelectorParams): Promise<TAgent[]>;
    saveAgent(req: {
        agentName: string;
        agentSpec: TSpec;
    }): Promise<TSave>;
    deleteAgent?(req: { agentName: string }): Promise<void>;
}
