# Changelog

## Unreleased

### Added

- Advanced agent configuration contracts for model limits and optional costs, model parameters, runtime settings, and lazy MCP tool selection.
- TrueFoundry builder adapter enrichment for model metadata and MCP tool discovery.

## 0.1.18

### Added

- **`getModels` reasoning efforts** — `listEnabledModels` also fetches `/api/svc/v1/provider-accounts/providers` and sets `properties.reasoningEfforts` for thinking-capable models (same visibility rules as ai.tf: skip exact `openai` slug, require `thinking: true`, honor `removeParams`).

### Fixed

- **Extras ancestor walk vs RootAssistantClient** — `tryGetTrueFoundryExtras` / `useTrueFoundryRuntimeExtras` try/catch Proxy gets when walking `Object.create(parent)` AUI clients, so hitting the store’s RootAssistantClient prototype no longer throws `The current scope does not have a "subscribe" property`. `trueFoundryExtras.get` / `.use` use the same walk (no nested-UI footgun).
- **`getModels` latency** — enabled-models and provider-metadata CP fetches run in parallel; providers soft-fails without blocking the model list.
- **Model selector `name` is model_fqn** — `normalizeEnabledModels` sets `ModelSelectorEntry.name` (and `id`) to `model_fqn`, so trueforge-ui’s DraftModelSelector writes `AgentSpec.model.name` as `account/model-id` instead of the short CP display label.
- **Gateway mount sanitization** — `normalizeMcpMount` / `normalizeSkillMount` rebuild allowlisted registry/git/inline shapes instead of blind-passthrough, so FE `id` / display `name` / registry `url` never leak onto draft create/update. Registry MCP mounts default `enableTools` to `["@all"]` when missing (narrow lists still preserved).

## 0.1.12

### Breaking

- **`SandboxCatalogServer` method renames (sandbox → sandbox provider)**  
  `getSandboxCatalog` → `getSandboxProviderCatalog`, `listSandboxes` → `listSandboxProviders`, `createSandbox` → `createSandboxProvider`, `updateSandbox` → `updateSandboxProvider`, `deleteSandbox` → `deleteSandboxProvider?` (now optional). Host aliases (`SandboxProviderConfig`, `SandboxProviderCatalogEntry`, `SandboxProviderBase`, `CreateSandboxProviderRequest`, `UpdateSandboxProviderRequest`) map to the existing DTO names.

- **`SandboxBase` now extends `SandboxConfig`**  
  Connected rows always carry last-saved provider settings so update forms can show previous values.

- **`UpdateSandboxRequest.apiKey` is optional**  
  Omit to keep the existing key; send a value to rotate.

- **`ConnectorBase.tools` removed**  
  Tools are no longer embedded on the connector row. Fetch with new required `ConnectorCatalogServer.getToolsByConnectorId({ id })`. `ConnectorBase` is no longer generic in `TTool`.

- **`ConnectorCatalogServer` adds required `getConnector` / `getToolsByConnectorId`**  
  Implement both on every catalog adapter.

- **`authenticateConnector` request/return changed**  
  Request is `AuthenticateConnectorRequest` (`id` + optional `returnTo`). Return is `TConnector | ConnectorAuthenticationResult<TConnector>` — either an authenticated connector (or one carrying `auth.authUrl`) or a result with `authorization_endpoint` for the popup flow.

- **`ConnectorAuthPublicOAuth.authUrl` is optional**  
  Public dcr rows may omit `authUrl` when auth is started via `authorization_endpoint` instead. (Supersedes the 0.1.8 note that public dcr required `authUrl`.)

### Added

- **Sole ownership of server-port types** — this package is the canonical home for `AgentChatServer` / `AgentBuilderServer` / catalog ports and DTOs. Hosts (e.g. trueforge-ui) should re-export, not fork.
- **`AgentUIServer`** — host-facing alias of `AgentUIServerPort`.
- **Selector / compose aliases** — `ModelSelection`, `AgentSkill`, `ConnectorState`, `AgentLibraryEntry`, `SearchAgentsParams` (aliases of the `*SelectorEntry` / `SearchAgentSelectorParams` names).
- **Root exports** for builder/catalog types previously internal to `server/` (`SaveAgentRequest`, `AgentBuilderCapabilitiesResponse`, `AuthenticateConnectorRequest`, `ConnectorAuthenticationResult`, mounts, selector entries, sandbox-provider aliases, etc.).
- **`ModelSelectorEntry.providerLogo?`**, **`ConnectorSelectorEntry.requiresAuth?` / `authenticated?`**, **`ModelProviderCatalogEntry.supportedReasoningEfforts?` / `logo?`**, **`ConnectorCatalogEntry.logo?`**.
- **`SaveAgentRequest`** — named request body for `AgentBuilderServer.saveAgent`.
- **`createTrueFoundryAgentUIServer.getCapabilities`** — returns sandbox / skill / settings enabled (stub; always `true` for this pack).
- **`PreviousTurnIdInput` documents `"none"`** alongside `"auto"` and turn ids.

### Fixed

- **`sessionToThreadMetadata`** — always stamps `custom.isMutable` from the session (plus `agentName` when present). History UIs can trust mutability without inferring it from `agentName`, so ref sessions whose agent was deleted stay immutable.

## 0.1.10

### Breaking

- **`ListSessionsParams.agentName` → `agentId`**  
  Thread-list adapters and the TFY chat server forward the optional filter as `agentId`. Hosts that previously keyed list filters by name should pass that same value as `agentId` (or via `listSessionsAgentId` on the runtime / adapters).

- **Draft thread list no longer filters `isMutable` client-side**  
  `createTrueFoundryDraftThreadListAdapter.list` returns every session from `listSessions`. Title named (immutable) rows with `title → agentName → id`, not the draft model name.

### Added

- **`listSessionsAgentId?: string`** on `useTrueFoundryAgentRuntime` and all three thread-list adapters (`createTrueFoundryThreadListAdapter`, `createTrueFoundryDraftThreadListAdapter`, `createTrueFoundryOwnedSessionsThreadListAdapter`). Omit to list all chats; set to filter `listSessions({ agentId })`.
- **`AgentSelectorEntry.agentId?` / `agentSpec?`** — CP `normalizeAgents` fills these from agent id + `latestVersionDetails.manifest` so hosts can offer Edit when a published spec is present.
- **`agentSpecFromCpManifest` / `toCamelCaseDeep`** — map CP AgentManifest (snake_case) → FE `TfyAgentSpec` for Edit seeding, preserving agent `config` and mount `enableTools` / `preload` / `config`.
- **`sessionDisplayTitle` / `sessionToThreadMetadata`** — shared session → thread-list metadata helpers; named sessions expose `custom.agentName` when present.

### Fixed

- **Edit → Save round-trip** — catalog mounts from CP keep runtime fields; `normalizeMcpMount` / `normalizeSkillMount` forward `enableTools`, `preload`, and `config` so save no longer defaults MCP tools to `@all`, forces skill `preload: false`, or drops config.
- **Untitled named sessions in draft history** — mixed lists use `sessionDisplayTitle` so immutable rows fall back to `agentName` / `id` instead of `defaultAgentSpec.model.name`.

### Changed

- Bump `@assistant-ui/core` to `^0.2.22` and `@assistant-ui/store` to `^0.2.21`.

## 0.1.9

### Added

- **Sandboxes catalog** — new `SandboxCatalogServer` port and DTOs (`SandboxConfig`, `SandboxCatalogEntry`, `SandboxBase`, `CreateSandboxRequest`, `UpdateSandboxRequest`). Exposed as the optional `CatalogServer.sandboxCatalog` sub-port. `SandboxConfig` holds the mutable settings (`snapshotName`, `execTimeoutMs`, `autoStopIntervalInMinutes`, `autoArchiveIntervalInMinutes`, `autoDeleteIntervalInMinutes`) shared by catalog rows, create, and update; create adds `apiKey`.
- **Skills catalog** — `SkillCatalogServer.getSkillCatalog()` plus registry/github skill DTOs (`RegistrySkill`, `GithubSkill`, `DefinedSkill`, `SkillConfigBase`, `SkillCatalogEntry`, `CreateSkillRequestBase`, `SelectRegistrySkillRequest`, `ImportGithubSkillRequest`). Registry vs github is distinguished by `catalogId` presence, not a `type` field.
- **`ModelSelectorEntry.reasoningEfforts?: string[]`** and **`ToolBase.description: string`**.

## 0.1.8

### Breaking

- **`AgentChatServer.prepareAndExecuteTurn` → `createTurn`**  
  Rename the method on every `AgentChatServer` implementation and mock. Signature and return type are unchanged.

- **`ConnectorAuthType` is now `"dcr" | "header" | "none"`**  
  Previously an open `string` with documented display labels (`"None"`, `"OAuth"`, `"API Key"`). Map host/wire values to these literals.

- **`ConnectorAuth` / `ConnectorAuthPublic` are discriminated unions**  
  - Write: `{ type: "dcr"; authUrl?: string } | { type: "header"; apiKey?: string; headerName?: string } | { type: "none" }`  
  - Public: dcr branch requires `authUrl: string` (no secrets).  
  Branch types (`ConnectorAuthOAuth`, `ConnectorAuthPublicOAuth`, …) are exported so hosts can intersect extras and re-union, e.g. `ConnectorAuthPublicOAuth & { custom: string }`.

- **`ConnectorBase.requiresAuth: boolean`**  
  Required alongside existing `authenticated`. When `requiresAuth` is true, UI should not show Disconnect.

### Notes

- After `authenticateConnector`, the authorize URL is on `connector.auth.authUrl` when `auth.type === "dcr"` (not a separate widened return field).
