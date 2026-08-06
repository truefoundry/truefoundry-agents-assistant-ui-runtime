# Changelog

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
