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
    TurnStreamData
} from "./events.js";

// ---------------------------------------------------------------------------
// Catalog — selector rows (SDK-minimal; host extends via generics)
// ---------------------------------------------------------------------------

/** Model selector row. Host extends for apiModel, modelId, pricing, etc. */
export interface ModelSelectorEntry {
    name: string;
    provider: string;
    reasoningEfforts?: string[];
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
// AgentSpec — model / skills / mcpServers are type params; host widens the rest
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
 * Host widens `model` / `skills` / `mcpServers` via type params, and adds
 * extra fields via `TSpec extends AgentSpec<...>`.
 */
export interface AgentSpec<
    TModel extends Model = Model,
    TSkill extends SkillMount = SkillMount,
    TMcp extends McpServerMount = McpServerMount,
> {
    model: TModel;
    skills?: TSkill[];
    mcpServers?: TMcp[];
    instructions?: string;
    variables?: Record<string, string>;
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

    createTurn(req: {
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

// ---------------------------------------------------------------------------
// Catalog management — FE-minimal settings DTOs (host extends via generics)
// ---------------------------------------------------------------------------

/**
 * Provider type id. Reserved literal: `"custom"` for user-defined providers;
 * any other string is a builtin (e.g. `"openai"`, `"anthropic"`).
 *
 * Note: `string | "custom"` is useless in TypeScript (`"custom"` ⊆ `string`),
 * so this stays `string` and `"custom"` is a documented convention.
 */
export type ProviderType = string;

/**
 * Model row — form "Model ID" + "Display name".
 * Host extends for properties, etc.
 */
export interface ModelEntry {
    id: string;
    name: string;
}

/**
 * Write config for create/update (custom form + catalog "Save key").
 * Host extends. `baseUrl` present iff `type === "custom"`.
 */
export interface ModelProviderConfigBase<TModel extends ModelEntry = ModelEntry> {
    type: ProviderType;
    name: string;
    /** Present iff `type === "custom"`. */
    baseUrl?: string;
    apiKey: string;
    models: TModel[];
}

/**
 * Configured provider card (list/read). No raw `apiKey`.
 * Host extends for apiKeySet, timestamps, etc.
 */
export interface ModelProviderBase<TModel extends ModelEntry = ModelEntry> {
    id: string;
    type: ProviderType;
    name: string;
    /** Present iff `type === "custom"`. */
    baseUrl?: string;
    models: TModel[];
}

/**
 * Discovery-only catalog provider (AVAILABLE list).
 * `type` must not be `"custom"` — custom providers use the custom form.
 * Host extends for richer model rows.
 */
export interface ModelProviderCatalogEntry<TModel extends ModelEntry = ModelEntry> {
    type: ProviderType;
    name: string;
    models: TModel[];
}

/** Create — no `id`; server assigns it. Catalog path = entry + apiKey. */
export type CreateModelProviderRequest<TModel extends ModelEntry = ModelEntry> =
    ModelProviderConfigBase<TModel>;

/** Update — `id` required. */
export type UpdateModelProviderRequest<TModel extends ModelEntry = ModelEntry> =
    ModelProviderConfigBase<TModel> & { id: string };

export interface ModelCatalogServer<
    TModel extends ModelEntry = ModelEntry,
    TProvider extends ModelProviderBase<TModel> = ModelProviderBase<TModel>,
    TCatalogProvider extends ModelProviderCatalogEntry<TModel> = ModelProviderCatalogEntry<TModel>,
    TCreate extends CreateModelProviderRequest<TModel> = CreateModelProviderRequest<TModel>,
    TUpdate extends UpdateModelProviderRequest<TModel> = UpdateModelProviderRequest<TModel>,
> {
    getModelProviderCatalog(): Promise<TCatalogProvider[]>;
    listModelProviders(): Promise<TProvider[]>;
    createModelProvider(req: TCreate): Promise<TProvider>;
    /** Full replace update keyed by provider `id`. */
    updateModelProvider(req: TUpdate): Promise<TProvider>;
    deleteModelProvider?(req: { id: string }): Promise<void>;
}

/** Tool row on a connector detail. Host extends for schemas, etc. */
export interface ToolBase {
    id: string;
    name: string;
    description: string;
}

/** Strict auth type id. Hosts widen branches via intersection + re-union. */
export type ConnectorAuthType = "dcr" | "header" | "none";

// Write (create/update) — export branches so hosts can intersect extras
export type ConnectorAuthOAuth = { type: "dcr"; authUrl?: string };
export type ConnectorAuthApiKey = {
    type: "header";
    apiKey?: string;
    headerName?: string;
};
export type ConnectorAuthNone = { type: "none" };
export type ConnectorAuth =
    | ConnectorAuthOAuth
    | ConnectorAuthApiKey
    | ConnectorAuthNone;

// Public (list/detail) — no secrets; dcr requires authUrl
export type ConnectorAuthPublicOAuth = { type: "dcr"; authUrl: string };
export type ConnectorAuthPublicApiKey = {
    type: "header";
    headerName?: string;
};
export type ConnectorAuthPublicNone = { type: "none" };
export type ConnectorAuthPublic =
    | ConnectorAuthPublicOAuth
    | ConnectorAuthPublicApiKey
    | ConnectorAuthPublicNone;

/**
 * MCP / connector create-edit config. Host extends for extra fields, etc.
 */
export interface ConnectorConfigBase<
    TAuth extends ConnectorAuth = ConnectorAuth,
> {
    name: string;
    url: string;
    auth: TAuth;
}

/**
 * Connected connector row (settings/connectors). No raw `apiKey`.
 * Host extends.
 */
export interface ConnectorBase<
    TTool extends ToolBase = ToolBase,
    TAuth extends ConnectorAuthPublic = ConnectorAuthPublic,
> {
    id: string;
    name: string;
    description: string;
    url: string;
    auth: TAuth;
    /** When true, UI should not show Disconnect. */
    requiresAuth: boolean;
    authenticated: boolean;
    tools: TTool[];
}

/** Discovery catalog entry for "+ Add MCP server". Host extends. */
export interface ConnectorCatalogEntry<
    TAuth extends ConnectorAuthPublic = ConnectorAuthPublic,
> {
    id: string;
    name: string;
    description?: string;
    url: string;
    auth: TAuth;
}

/** Create connector — no `id`; server assigns it. Host extends. */
export type CreateConnectorRequest<TAuth extends ConnectorAuth = ConnectorAuth> =
    ConnectorConfigBase<TAuth>;

/** Update connector — `id` required. Host extends. */
export type UpdateConnectorRequest<TAuth extends ConnectorAuth = ConnectorAuth> =
    ConnectorConfigBase<TAuth> & { id: string };

export interface ConnectorCatalogServer<
    TTool extends ToolBase = ToolBase,
    TAuthWrite extends ConnectorAuth = ConnectorAuth,
    TAuthPublic extends ConnectorAuthPublic = ConnectorAuthPublic,
    TConnector extends ConnectorBase<TTool, TAuthPublic> = ConnectorBase<
        TTool,
        TAuthPublic
    >,
    TCatalogEntry extends ConnectorCatalogEntry<TAuthPublic> =
        ConnectorCatalogEntry<TAuthPublic>,
    TCreate extends CreateConnectorRequest<TAuthWrite> =
        CreateConnectorRequest<TAuthWrite>,
    TUpdate extends UpdateConnectorRequest<TAuthWrite> =
        UpdateConnectorRequest<TAuthWrite>,
> {
    getConnectorCatalog(): Promise<TCatalogEntry[]>;
    listConnectors(req?: { query?: string }): Promise<TConnector[]>;
    createConnector(req: TCreate): Promise<TConnector>;
    /** Full replace update keyed by connector `id`. */
    updateConnector(req: TUpdate): Promise<TConnector>;
    /**
     * Start connector auth (e.g. OAuth).
     * For oauth, the returned connector's `auth.authUrl` is the authorize URL.
     */
    authenticateConnector(req: { id: string }): Promise<TConnector>;
    /** Clear connector auth. */
    disconnectConnector(req: { id: string }): Promise<TConnector>;
    deleteConnector?(req: { id: string }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Skills catalog — FE-minimal settings DTOs (host extends via generics)
// ---------------------------------------------------------------------------

/** Skill row shown in settings/skills (list + delete). Host extends for fqn, etc. */
export interface SkillBase {
    id: string;
    name: string;
    description: string;
}

export interface RegistrySkill extends SkillBase {
    /** `SkillCatalogEntry.id` this skill was created from. */
    catalogId: string;
}

export interface GithubSkill extends SkillBase {}

export type DefinedSkill = RegistrySkill | GithubSkill;

/** Git source fields shared by catalog entries and create requests. */
export interface SkillConfigBase {
    name: string;
    description: string;
    repoURL: string;
    path: string;
    ref: string;
}

export interface SkillCatalogEntry extends SkillConfigBase {
    id: string;
}

/** Create-skill base. Hosts may intersect extra fields and re-union. */
export interface CreateSkillRequestBase extends SkillConfigBase {}

export interface SelectRegistrySkillRequest extends CreateSkillRequestBase {
    /** `SkillCatalogEntry.id`, persisted so the created skill links back to it. */
    catalogId: string;
}

export interface ImportGithubSkillRequest extends CreateSkillRequestBase {}

export type CreateSkillRequest =
    | SelectRegistrySkillRequest
    | ImportGithubSkillRequest;

export interface SkillCatalogServer<
    TSkill extends SkillBase = SkillBase,
    TCatalogEntry extends SkillCatalogEntry = SkillCatalogEntry,
    TCreate extends CreateSkillRequest = CreateSkillRequest,
> {
    getSkillCatalog(): Promise<TCatalogEntry[]>;
    listSkills(req?: { query?: string }): Promise<TSkill[]>;
    createSkill(req: TCreate): Promise<TSkill>;
    deleteSkill?(req: { id: string }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Sandboxes catalog — public rows omit credentials; writes accept them
// ---------------------------------------------------------------------------

/** Mutable sandbox settings shared by catalog rows, create, and update. */
export interface SandboxConfig {
    execTimeoutMs: number;
    autoStopIntervalInMinutes: number;
    autoArchiveIntervalInMinutes: number;
    autoDeleteIntervalInMinutes: number;
}

export interface SandboxCatalogEntry extends SandboxConfig {
    id: string;
    name: string;
    type: string;
}

export interface SandboxBase extends SandboxConfig {
    id: string;
    name: string;
    catalogId: string;
    isConnected: boolean;
}

export type SandboxSnapshotSyncStatus = {
    status: "pending" | "ready" | "failed";
    statusReason?: string | null;
};

export interface SandboxProviderListEntry<
    TSandbox extends SandboxBase = SandboxBase,
> {
    data: TSandbox;
    snapshotSyncStatus: SandboxSnapshotSyncStatus;
}

export interface CreateSandboxRequest extends SandboxConfig {
    /** `SandboxCatalogEntry.id` used to create this sandbox. */
    catalogId: string;
    name: string;
    type: string;
    apiKey: string;
}

export interface UpdateSandboxRequest extends SandboxConfig {
    id: string;
    apiKey: string;
}

export interface SandboxCatalogServer<
    TSandbox extends SandboxBase = SandboxBase,
    TCatalogEntry extends SandboxCatalogEntry = SandboxCatalogEntry,
    TCreate extends CreateSandboxRequest = CreateSandboxRequest,
    TUpdate extends UpdateSandboxRequest = UpdateSandboxRequest,
    TListEntry extends SandboxProviderListEntry<TSandbox> =
        SandboxProviderListEntry<TSandbox>,
> {
    getSandboxCatalog(): Promise<TCatalogEntry[]>;
    listSandboxes(req?: { query?: string }): Promise<TListEntry[]>;
    createSandbox(req: TCreate): Promise<TSandbox>;
    updateSandbox(req: TUpdate): Promise<TSandbox>;
    deleteSandbox(req: { id: string }): Promise<void>;
}

/**
 * Settings management aggregate — modelCatalog + connectorCatalog + optional
 * skill and sandbox catalogs.
 * Hosts may pass the whole object to an app shell, or a focused sub-port to a page.
 */
export interface CatalogServer<
    TModelCatalog extends ModelCatalogServer = ModelCatalogServer,
    TConnectorCatalog extends ConnectorCatalogServer = ConnectorCatalogServer,
    TSkillCatalog extends SkillCatalogServer = SkillCatalogServer,
    TSandboxCatalog extends SandboxCatalogServer = SandboxCatalogServer,
> {
    modelCatalog: TModelCatalog;
    connectorCatalog: TConnectorCatalog;
    /** Optional — omit when the host has no skills settings surface. */
    skillCatalog?: TSkillCatalog;
    /** Optional — omit when the host has no sandboxes settings surface. */
    sandboxCatalog?: TSandboxCatalog;
}

/**
 * Composed host port: chat + builder + optional settings catalog.
 * Agent-ui's `AgentUIServer` mirrors this shape; named differently here to
 * avoid colliding with that package's local type name.
 *
 * `catalog` is optional — if the host passes it, settings UI can call
 * `useCatalogServer()` / show modelCatalog, connectorCatalog, and skillCatalog;
 * if omitted, those surfaces stay hidden.
 */
export type AgentUIServerPort<
    TChat extends AgentChatServer = AgentChatServer,
    TBuilder extends AgentBuilderServer = AgentBuilderServer,
    TCatalog extends CatalogServer = CatalogServer,
> = TChat & TBuilder & { catalog?: TCatalog };
