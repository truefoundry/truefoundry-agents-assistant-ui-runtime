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
  /** Provider logo URL from the model catalog; selector falls back to a monogram when omitted. */
  providerLogo?: string;
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
  /** When true, the connector must be authenticated before use. Omitted when the host does not report auth. */
  requiresAuth?: boolean;
  /** When true, the connector is already authenticated. Omitted when the host does not report auth. */
  authenticated?: boolean;
}

/** Agent selector row. Host extends for metadata; `agentSpec` enables Edit. */
export interface AgentSelectorEntry {
  name: string;
  /** Stable id when distinct from display `name`. Falls back to `name` when omitted. */
  agentId?: string;
  /** Published agent spec — required for Edit; optional for Try-only hosts. */
  agentSpec?: AgentSpec;
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
  /** Host-owned agent identity filter. Hosts that key agents by name pass that name here. */
  agentId?: string;
  /** Host-specific filter (e.g. TFY startTimestamp). */
  startTimestamp?: string;
}

export type PreviousTurnIdInput = "auto" | "none" | string;

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

  /**
   * Reads a file the agent wrote inside its sandbox. Hosts whose download route is scoped to a
   * turn resolve the sandbox from `turnId` and ignore `sandboxId`; hosts addressing sandboxes
   * directly use `sandboxId`.
   */
  downloadSandboxFile?(req: {
      sessionId: string;
      turnId: string;
      sandboxId: string;
      path: string;
  }): Promise<Blob>;
}

/** Request body for `AgentBuilderServer.saveAgent`. */
export interface SaveAgentRequest<TSpec extends AgentSpec = AgentSpec> {
  agentName: string;
  agentSpec: TSpec;
}

/**
 * Builder feature flags — atoms gate sandbox / skill / settings surfaces on these.
 */
export interface AgentBuilderCapabilitiesResponse {
  data: {
    sandbox: { enabled: boolean };
    skill: { enabled: boolean; reason?: string };
    settings?: { enabled: boolean };
  };
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
  TCapabilities extends AgentBuilderCapabilitiesResponse = AgentBuilderCapabilitiesResponse,
> {
  getCapabilities(): Promise<TCapabilities>;
  getModels(): Promise<TModel[]>;
  getSkills(): Promise<TSkill[]>;
  getMcp(): Promise<TMcp[]>;
  searchAgents(req?: SearchAgentSelectorParams): Promise<TAgent[]>;
  saveAgent(req: SaveAgentRequest<TSpec>): Promise<TSave>;
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
  supportedReasoningEfforts?: string[];
  logo?: string;
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

// Public (list/detail) — no secrets
export type ConnectorAuthPublicOAuth = { type: "dcr"; authUrl?: string };
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
 * Connected connector row (settings/connectors). No raw `apiKey` or tools.
 * Tools are fetched separately with `getToolsByConnectorId`.
 * Host extends.
 */
export interface ConnectorBase<
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
  logo?: string;
}

/** Create connector — no `id`; server assigns it. Host extends. */
export type CreateConnectorRequest<TAuth extends ConnectorAuth = ConnectorAuth> =
  ConnectorConfigBase<TAuth>;

/** Update connector — `id` required. Host extends. */
export type UpdateConnectorRequest<TAuth extends ConnectorAuth = ConnectorAuth> =
  ConnectorConfigBase<TAuth> & { id: string };

export interface AuthenticateConnectorRequest {
  id: string;
  /** OAuth callback page owned by the host application. */
  redirectURL?: string;
}

export interface ConnectorAuthenticationResult<
  TConnector extends ConnectorBase = ConnectorBase,
> {
  connector?: TConnector;
  status?: string;
  authorization_endpoint?: string | undefined;
}

export interface ConnectorCatalogServer<
  TTool extends ToolBase = ToolBase,
  TAuthWrite extends ConnectorAuth = ConnectorAuth,
  TAuthPublic extends ConnectorAuthPublic = ConnectorAuthPublic,
  TConnector extends ConnectorBase<TAuthPublic> = ConnectorBase<TAuthPublic>,
  TCatalogEntry extends ConnectorCatalogEntry<TAuthPublic> =
    ConnectorCatalogEntry<TAuthPublic>,
  TCreate extends CreateConnectorRequest<TAuthWrite> =
    CreateConnectorRequest<TAuthWrite>,
  TUpdate extends UpdateConnectorRequest<TAuthWrite> =
    UpdateConnectorRequest<TAuthWrite>,
> {
  getConnectorCatalog(): Promise<TCatalogEntry[]>;
  getConnector(req: { id: string }): Promise<TConnector>;
  listConnectors(req?: { query?: string }): Promise<TConnector[]>;
  getToolsByConnectorId(req: { id: string }): Promise<TTool[]>;
  createConnector(req: TCreate): Promise<TConnector>;
  /** Full replace update keyed by connector `id`. */
  updateConnector(req: TUpdate): Promise<TConnector>;
  /**
   * Start connector auth (e.g. OAuth).
   * May return a connector (already authenticated / with `auth.authUrl`) or a
   * result carrying `authorization_endpoint` for the popup flow.
   */
  authenticateConnector(
    req: AuthenticateConnectorRequest,
  ): Promise<TConnector | ConnectorAuthenticationResult<TConnector>>;
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
// Sandbox providers catalog — public rows omit credentials; writes accept them
// ---------------------------------------------------------------------------

/** Mutable sandbox provider settings shared by catalog rows, create, and update. */
export interface SandboxConfig {
  snapshotName: string;
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

/**
 * Connected sandbox provider row (settings/sandboxes). No raw `apiKey`.
 * Includes last-saved config so update forms can show previous values.
 */
export interface SandboxBase extends SandboxConfig {
  id: string;
  name: string;
  catalogId: string;
  isConnected: boolean;
}

export interface CreateSandboxRequest extends SandboxConfig {
  /** `SandboxCatalogEntry.id` used to create this sandbox provider. */
  catalogId: string;
  name: string;
  type: string;
  apiKey: string;
}

export interface UpdateSandboxRequest extends SandboxConfig {
  id: string;
  /** Omit to keep the existing key; send a value to rotate. */
  apiKey?: string;
}

/** Host-facing aliases (trueforge-ui public names). */
export type SandboxProviderConfig = SandboxConfig;
export type SandboxProviderCatalogEntry = SandboxCatalogEntry;
export type SandboxProviderBase = SandboxBase;
export type CreateSandboxProviderRequest = CreateSandboxRequest;
export type UpdateSandboxProviderRequest = UpdateSandboxRequest;

export interface SandboxCatalogServer<
  TProvider extends SandboxBase = SandboxBase,
  TCatalogEntry extends SandboxCatalogEntry = SandboxCatalogEntry,
  TCreate extends CreateSandboxRequest = CreateSandboxRequest,
  TUpdate extends UpdateSandboxRequest = UpdateSandboxRequest,
> {
  getSandboxProviderCatalog(): Promise<TCatalogEntry[]>;
  listSandboxProviders(req?: { query?: string }): Promise<TProvider[]>;
  createSandboxProvider(req: TCreate): Promise<TProvider>;
  updateSandboxProvider(req: TUpdate): Promise<TProvider>;
  deleteSandboxProvider?(req: { id: string }): Promise<void>;
}

/** Host-facing selector / compose aliases (trueforge-ui public names). */
export type ModelSelection = ModelSelectorEntry;
export type AgentSkill = SkillSelectorEntry;
export type ConnectorState = ConnectorSelectorEntry;
export type AgentLibraryEntry = AgentSelectorEntry;
export type SearchAgentsParams = SearchAgentSelectorParams;

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
 *
 * `catalog` is optional — if the host passes it, settings UI can call
 * `useCatalogServer()` / show modelCatalog, connectorCatalog, and skillCatalog;
 * if omitted, those surfaces stay hidden.
 *
 * trueforge-ui re-exports this as `AgentUIServer`.
 */
export type AgentUIServerPort<
  TChat extends AgentChatServer = AgentChatServer,
  TBuilder extends AgentBuilderServer = AgentBuilderServer,
  TCatalog extends CatalogServer = CatalogServer,
> = TChat & TBuilder & { catalog?: TCatalog };

/** Host-facing alias used by trueforge-ui. */
export type AgentUIServer = AgentUIServerPort;
