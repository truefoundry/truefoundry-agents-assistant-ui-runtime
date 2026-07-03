# TrueFoundry Agent Platform — Implementation Reference

Copy-paste guide for wiring the same auth / skills / MCP / model logic into
another project. All endpoints are TrueFoundry control-plane (`{cp}`) and
gateway (`{gw}`) URLs. Every control-plane call goes through a single
`cpFetch` wrapper (see §1.3) that picks the right credential per auth mode.

---

## 1. Login / Logout

There are TWO auth modes chosen at boot by env var `AGENT_MODE`:

| Mode         | Env value      | Credential on `/api/svc/*`      | Gateway credential |
| ------------ | -------------- | -------------------------------- | ------------------- |
| Device code  | `STANDALONE`   | `Authorization: Bearer <JWT>`    | same JWT |
| Cookie/SSO   | `CP_AUTH`      | HttpOnly session cookie (`credentials: "include"`) | Personal Access Token (in-memory only) |

Detection is a one-liner — no hostname sniffing:

```ts
export function detectAuthMode(): "device" | "cookie" {
  return AGENT_MODE === "STANDALONE" ? "device" : "cookie";
}
```

### 1.1 Device-code flow (STANDALONE)

Reverse-engineered from the official `truefoundry` Python SDK.

**Step 1 — resolve tenant name from the CP hostname**

```
GET {cp}/api/svc/v1/tenant-id?hostName={host}
→ 200 { "tenant_name": "acme" }        // or { tenantName: ... }
```

**Step 2 — request device + user code**

```
POST {cp}/api/svc/v1/oauth2/device-authorize
Content-Type: application/json
{ "tenantName": "acme" }

→ 200 {
  "userCode": "ABCD-1234",
  "deviceCode": "long-opaque-string",
  "verificationURI": "https://{cp}/authorize/device",
  "verificationURIComplete": "https://{cp}/authorize/device?userCode=ABCD-1234",
  "expiresInSeconds": 600,
  "intervalInSeconds": 2
}
```

Open `verificationURIComplete` in a new tab; user approves there.

**Step 3 — poll for token**

```
POST {cp}/api/svc/v1/oauth2/token
{
  "tenantName": "acme",
  "deviceCode": "...",
  "grantType": "device_code",
  "returnJWT": true
}

→ 202 (empty)                            // keep polling every intervalInSeconds
→ 201 { "accessToken": "<JWT>", "refreshToken": "<opaque or null>" }
```

**Step 4 — refresh (proactive, ~120s before `exp`)**

```
POST {cp}/api/svc/v1/oauth2/token
{
  "tenantName": "acme",
  "refreshToken": "...",
  "grantType": "refresh_token",
  "returnJWT": true
}

→ 200 { "accessToken": "<JWT>", "refreshToken": "<possibly-rotated or same>" }
```

**Storage — `localStorage["tf_auth_v1"]`:**

```ts
interface StoredAuth {
  controlPlaneUrl: string;   // origin, no trailing slash
  tenantName: string;
  accessToken: string;       // JWT
  refreshToken: string | null;
  expiresAt: number;         // unix seconds, decoded from JWT `exp`
}
```

The refresh scheduler decodes `exp` from the JWT payload and calls
`refreshAccessToken()` `exp - 120s` before expiry, then reschedules
itself with the fresh token. There is **no reactive 401→refresh→retry**;
if we ever see drift, add that in the fetch wrapper.

**Logout (STANDALONE):** just wipe local state. There is no server-side
session to invalidate.

```ts
localStorage.removeItem("tf_auth_v1");
// Optional: also clear app-specific caches like enabled skills / mcps.
```

### 1.2 Cookie / CP session flow (CP_AUTH)

Used when the frontend is served from the same origin as the CP.
**No token is ever persisted** — the HttpOnly session cookie owns
identity, and the PAT for the gateway lives in memory only.

**Step 1 — probe session**

```
GET {cp}/api/svc/v1/session
   ?hostName={host}
   &tenantName={cachedTenantOrEmpty}
   &includeTenantInfo=true
credentials: include

→ 200 {
  "user": { "id": "usr_...", "email": "...", "tenantName": "acme" } | null,
  "tenantInfo": { "tenantName": "acme" }
}
→ 401 / 403       // not logged in → user = null
```

**Step 2 — if `user === null`, bounce to CP sign-in**

```
window.location.href =
  `{cp}/signin/external?redirectPath=${encodeURIComponent("/app/path/")}`
```

`/signin/external` runs the full OAuth round-trip and 302s back to
`redirectPath` on the CP origin. After the redirect, re-run step 1.

**Step 3 — fetch a Personal Access Token for gateway calls**

```
GET {cp}/api/svc/v1/personal-access-tokens/default-{userId}
credentials: include

→ 200 { "value": "pat_..." }   // shapes tried in order:
                               // json.value | json.token | json.accessToken
                               // | json.data.value | json.data.token | json.data.accessToken
```

Cache the PAT in a module-scoped `let inMemoryPat: string | null`.
Page reload → re-fetch. **Never** write it to localStorage / cookies /
IndexedDB.

**Logout (CP_AUTH):** CP logout responds with JSON (not a 302). You
must fetch it (so `Set-Cookie` clears the session cookie), then
navigate to the IdP `logoutURL` from the JSON body:

```
GET {cp}/api/svc/v1/oauth2/logout?tenantName=acme&redirectURL={cp}
credentials: include

→ 200 { "redirect": true, "logoutURL": "https://idp.example/logout?..." }
     + Set-Cookie: <session>=; Max-Age=0
```

Order matters:

```ts
1. clearInMemoryPat();                     // drop PAT + best-effort JS-cookie wipe
2. const r = await fetch(logoutEndpoint, { credentials: "include" });
3. const { logoutURL } = await r.json();
4. window.location.href = logoutURL ?? logoutEndpoint;
```

Do NOT top-level-navigate to the logout endpoint directly — you will
render the JSON blob in the tab. `redirectURL` must be the bare CP
origin (no path, no trailing slash) or the IdP will reject it.

### 1.3 Unified `cpFetch` wrapper

Every `/api/svc/*` call goes through this single function. Nothing else
knows about auth mode:

```ts
let currentMode: "device" | "cookie" = "device";

export async function cpFetch(
  url: string,
  token: string | null | undefined,
  init: RequestInit & { jsonBody?: unknown } = {},
): Promise<Response> {
  const { jsonBody, headers: raw, ...rest } = init;
  const headers: Record<string, string> = { ...(raw as any) };
  if (jsonBody !== undefined) headers["content-type"] ||= "application/json";

  const useCookies = currentMode === "cookie";
  if (!useCookies && token) headers["Authorization"] = `Bearer ${token}`;

  return fetch(url, {
    ...rest,
    headers,
    credentials: useCookies ? "include" : (rest.credentials ?? "same-origin"),
    body: jsonBody !== undefined ? JSON.stringify(jsonBody) : rest.body,
  });
}
```

Downstream code just passes the token it has (empty string is fine in
cookie mode) and never has to think about the mode.

---

## 2. Agents listing

Published agents are versioned manifests stored on the control plane. The UI lists them so users can open a chat against any agent.

### 2.1 List agents

```
GET {cp}/api/svc/v1/agents?limit=50&offset=0&namePrefix=
credentials via cpFetch

→ 200 {
  "data": [
    {
      "id": "agt_...",
      "name": "release-notes-writer",
      "fqn": "acme:release-notes-writer",
      "updatedAt": "2026-05-12T14:22:00Z",
      "createdBy": "...",
      "createdBySubject": {
        "subjectSlug": "anuraag@truefoundry.com",
        "subjectDisplayName": "Anuraag Gupta"
      },
      "latestVersionDetails": {
        "id": "agtv_...",
        "fqn": "acme:release-notes-writer:7",
        "manifest": { /* see below */ },
        "updatedAt": "2026-05-12T14:22:00Z"
      }
    }
  ]
}
```

**Manifest shape (`RawAgentManifest`)**

```ts
{
  name?: string;                // agent slug
  title?: string;               // human title
  description?: string;
  model?: { name?: string; params?: Record<string, unknown> };
  instruction?: string;         // system prompt
  tags?: string[];
  skills?: { fqn: string; name?: string }[];
  mcp_servers?: { name: string; displayName?: string; display_name?: string }[];
  model_params?: {
    max_tokens?: number;
    temperature?: number;
    reasoning_effort?: "minimal" | "low" | "medium" | "high";
  };
  iteration_limit?: number;
  sandbox?: { enabled?: boolean };
  sample_inputs?: { text?: string; variables?: Record<string, string> }[];
  source?: { description?: string };
}
```

**Normalization rules**

- Prefer `latestVersionDetails.manifest`; fall back to top-level `manifest`.
- `title` → `manifest.title ?? toDisplayName(manifest.name ?? raw.name)`.
- `description` → `manifest.description ?? manifest.source?.description ?? ""`.
- `model` → `manifest.model?.name ?? ""`.
- `model_params` → `manifest.model?.params ?? manifest.model_params ?? {}`.
- `skills` → map each `{ fqn, name ?? lastColonSegment(fqn) }`.
- `mcp_servers` → map each `{ name, displayName: manifest.displayName ?? manifest.display_name ?? toDisplayName(name) }`.
- `publishedBy` → from `latestVersionDetails.createdBySubject ?? raw.createdBySubject ?? raw.createdBy`.
- `updatedAt` → `latestVersionDetails.updatedAt ?? raw.updatedAt ?? now()`.

Normalized client shape:

```ts
interface SampleAgent {
  id: string;
  name: string;           // slug
  fqn?: string;
  versionId?: string;     // latestVersionDetails.id
  versionFqn?: string;    // latestVersionDetails.fqn
  title: string;
  description: string;
  model: string;          // api model name (empty string if absent)
  instruction: string;
  tags: string[];
  skills: { fqn: string; name: string }[];
  mcp_servers: { name: string; displayName: string }[];
  model_params: { max_tokens?: number; temperature?: number; reasoning_effort?: string };
  iteration_limit?: number;
  sandbox?: { enabled: boolean };
  sampleInputs?: { text?: string; variables?: Record<string, string> }[];
  publishedBy?: { name: string; email: string };
  collaborators?: { name: string; email: string }[];
  ownedBy?: string;
  updatedAt: string;
}
```

### 2.2 Running a published agent

When the user opens an agent, the chat enters **published-agent run mode**. The request shape is different from playground runs — the backend resolves manifest fields, so the client sends only:

```json
{
  "agent_name": "release-notes-writer",
  "model": "openai-main/gpt-5-chat-2025-08-15",
  "input": [...],
  "previous_response_id": null,
  "store": true,
  "stream": true
  // instruction, mcp_servers, skills, sandbox, iteration_limit, model_params
  // are all OMITTED — backend reads them from the agent manifest.
}
```

If the user had an existing conversation with this agent, reload it by passing `previous_response_id` from the saved conversation's last assistant turn.

## 3. Skills

Skills are versioned artifacts stored in ML repos. The UI lists them,
lets the user enable a subset, and sends the enabled FQNs on each
agent request.

### 3.1 List skills

```
GET {cp}/api/ml/v1/agent-skills?include_empty_agent_skills=false
Authorization: Bearer <JWT>    (or credentials: include)

→ 200 {
  "data": [
    {
      "id": "sk_abc",
      "ml_repo_id": "repo_xyz",
      "name": "code-review",
      "fqn": "acme/agents/code-review",
      "latest_version": {
        "id": "skv_123",
        "fqn": "acme/agents/code-review:7",
        "manifest": {
          "ml_repo": "acme/agents",
          "version": 7,
          "source": { "description": "Reviews PRs" }
        }
      }
    }
  ]
}
```

Normalize to:

```ts
interface AgentSkill {
  id: string;              // sk_...            (deep-link)
  versionId: string;       // latest_version.id (deep-link)
  name: string;
  mlRepo: string;          // manifest.ml_repo
  fqn: string;             // latest_version.fqn  ← THIS is what the agent wants
  description?: string;
}
```

Skip any row without `latest_version`.

### 3.2 Enabled-skill state (client)

Persisted in `localStorage["tf_enabled_skills_v1"]` as a JSON array of
`fqn` strings. Same shape for `tf_eager_skills_v1` (skills forced into
context on every turn instead of tool-called).

Seeding rules (only when localStorage is empty for that key):

- Env `DEFAULT_SELECTED_SKILLS = "all"` → enable every loaded skill
  (deferred until skills load, guarded so it runs once).
- Env `DEFAULT_SELECTED_SKILLS = "repo:name,repo/other"` → resolve each
  entry to the loaded skill whose `fqn` matches with the trailing
  `:version` stripped, add that skill's versioned `fqn`.

Prune once after load: drop stored FQNs that no longer correspond to
any loaded skill (otherwise the badge count inflates and the agent
API 400s).

### 3.3 Sending skills on an agent request

Enabled FQNs go into `skills: string[]` on the `POST {gw}/agent/responses`
body:

```json
{
  "model": "openai-main/gpt-5",
  "input": [...],
  "skills": ["acme/agents/code-review:7", "acme/agents/summarize:3"],
  ...
}
```

**Published agents:** the client MUST omit `skills` — backend resolves
from the agent manifest. Only `agent_name` + `input` +
`previous_response_id` go on the wire.

---

## 4. MCP servers (Connectors)

### 4.1 List MCP servers

```
GET {cp}/api/svc/v1/mcp-servers
credentials via cpFetch

→ 200 {
  "data": [
    {
      "id": "mcp_srv_abc",
      "name": "github",
      "fqn": "acme:github",
      "manifest": {
        "description": "GitHub repos + PRs",
        "tags": { "internal_platform": "true" },
        "auth_data": {
          "type": "oauth" | "header" | "passthrough",
          "auth_level": "per_user" | "shared"
        }
      },
      "authStatus": {
        "status": "authenticated" | "unauthenticated",
        "method": "oauth" | "auth-override",
        "message": "..."
      }
    }
  ]
}
```

`manifest` may arrive as a JSON string on some deployments — parse
defensively at the API boundary.

Normalized client shape:

```ts
interface ConnectorState {
  id: string;               // mcp name (dedupe key)
  name: string;             // display name
  mcpName: string;
  serverId: string | null;  // mcp_srv_...
  authenticated: boolean;   // authStatus.status !== "unauthenticated"
  alwaysOn: boolean;        // hardcoded list: truefoundry, web-search
  authMethod?: string;
  perUser: boolean;         // manifest.auth_data.auth_level === "per_user"
  description?: string;
  noAuthUi: boolean;        // no auth_data | passthrough | shared-header
}
```

### 4.2 Fetch one by id (with fresh auth status)

```
GET {cp}/api/svc/v1/mcp-servers/{serverId}
→ 200 { "data": { ... same shape as list rows ... } }
```

By name:

```
GET {cp}/api/svc/v1/mcp-servers/name/{mcpName}
→ 200 { "data": { "id": "...", "authStatus": { "status": "..." } } }
```

### 4.3 Per-user authorization / consent URL

```
GET {cp}/api/svc/v1/mcp/{serverId}/authorize
   ?gatewayBaseURL={gw}         (optional)

→ 200 { "status": "authenticated",             "method": "oauth" }
→ 200 { "status": "authentication_not_required" }
→ 200 {
    "status": "authentication_required",
    "authorization_endpoint": "https://provider/oauth?...",   // any of:
    //  authorizationEndpoint | consentUrl | consent_url |
    //  authorizationUrl | authorization_url | url
  }
```

On `authentication_required`, open the consent URL in a popup. The
popup posts `{ type: "mcp-oauth-success" }` back via `postMessage` on
completion; the parent listens and refreshes the connector list. As a
fallback, refresh on `window.focus` too.

### 4.4 Disconnect (non-per-user)

```
DELETE {cp}/api/svc/v1/llm-gateway/mcp-servers/{serverId}/auth
→ 204
```

For `perUser: true` MCPs there is no API disconnect — open the CP config
page in a popup so the user can revoke there:

```
{cp}/llm-gateway/mcp-servers?id={serverId}&mcp-server-tab=tools
```

### 4.5 Sending MCPs on an agent request

```json
{
  "mcp_servers": [
    { "integration_fqn": "acme:github" },
    { "integration_fqn": "acme:linear" }
  ]
}
```

(Field name / exact shape used by your backend — check the payload
`useAgentChat.runStream` emits.)

### 4.6 Mid-stream auth prompt

The agent SSE stream may emit an `mcp.auth_required` event with a
consent URL. Render an inline "Continue when done" panel. When the
user clicks continue, resume the **same** paused assistant turn:

```
POST {gw}/agent/responses
{
  "previous_response_id": "<paused assistant's response_id>",
  "input": [],
  // all other fields = current composer state (model, mcps, skills, etc.)
}
```

Do NOT rerun the prior user message.

---

## 5. Model selection

Models are loaded per-tenant from the gateway installation API. The
selector persists the user's choice in
`localStorage["tf_selected_model_v1"]`.

### 5.1 List enabled models

```
GET {cp}/api/svc/v1/llm-gateway/model/enabled
credentials via cpFetch

→ 200 {
  "<providerType>": {              // e.g. "openai" | "azure-openai" | "anthropic"
    "<providerAccountName>": [     // e.g. "openai-main"
      {
        "id": "mdl_...",
        "name": "GPT-5",
        "provider": "openai",                // slug — suffix of manifest type
        "provider_account_name": "openai-main",
        "model_id": "gpt-5-chat-2025-08-15", // bare provider id
        "model_fqn": "openai-main/gpt-5-chat-2025-08-15",
        "types": ["chat", "embedding", ...]
      }
    ]
  }
}
```

Client filters:

- Drop any model whose `types` is set and does NOT include `"chat"`.
- Drop any provider or model whose `provider` slug matches `/virtual/i`
  (virtual-model accounts — temporarily unsupported by the agent
  runtime).

Normalized `ModelEntry`:

```ts
interface ModelEntry {
  id: string;              // model_fqn
  name: string;
  provider: string;        // slug
  providerAccount: string; // account name
  apiModel: string;        // model_fqn — sent as `model` on requests
  modelId: string;         // bare id — used for metadata lookup
}
```

### 5.2 Model metadata (capabilities + limits)

```
GET {cp}/api/svc/v1/provider-accounts/providers?includeModelProviders=true
```

Returns provider manifests with per-model `features`, `limits`,
`params`, `removeParams`, `thinking`. Build a lookup map keyed by
`` `${providerSlug}/${modelId}` `` (e.g. `azure-openai/gpt-5-chat-...`).
The manifest's outer `type` is `provider-account/<slug>`; strip the
`provider-account/` prefix.

Never key on `model_fqn` or provider-account name — an admin renaming
their account would invalidate every lookup.

The full response schema lives at `docs/model-metadata-types.md` in
the source repo.

### 5.3 Derived per-model behavior

All rules in one place — do NOT branch on metadata anywhere else:

**`max_tokens`** (auto, never user-tunable):

1. AIMode → flat `25_000`.
2. `limits.context_window > 100_000` → `25_000`.
3. `limits.context_window` present ≤ 100k → `floor(context * 0.30)`.
4. context absent AND `removeParams` includes `max_tokens` → **omit key**.
5. Else → `5_000`.
6. Finally clamp to `params[key=max_tokens].maxValue` if present.

**`reasoning_effort`** (dropdown, single control):

- Hidden and NOT sent if provider slug === `"openai"` (exact),
  or `removeParams` includes `reasoning_effort`, or `meta.thinking !== true`.
- Otherwise: shown, default `"low"`, user choice persisted globally in
  `localStorage["tf_agent_reasoning_effort_v1"]`.

**`function_calling`**: if metadata is present and `features` lacks
`"function_calling"`, show a "No tool use" pill. Model stays selectable.

**Forced (not tunable, not in metadata):**

- `temperature` — always stripped from `model_params`.
- `cache_control` — always set to `{ "type": "ephemeral" }`.

### 5.4 Sending a chat request

```
POST {gw}/agent/responses
Authorization: Bearer <JWT-or-PAT>
Content-Type: application/json
Accept: text/event-stream

{
  "model": "openai-main/gpt-5-chat-2025-08-15",  // = ModelEntry.apiModel
  "input": [ { "role": "user", "content": [...] } ],
  "previous_response_id": null,
  "store": true,
  "stream": true,
  "mcp_servers": [...],
  "skills": ["acme/agents/x:3"],
  "instruction": "...",
  "sandbox": { ... },
  "iteration_limit": 20,
  "model_params": {
    "max_tokens": 5000,
    "reasoning_effort": "low",          // omitted when hidden
    "cache_control": { "type": "ephemeral" }
    // temperature intentionally absent
  }
}

→ 200 text/event-stream
   event: response.created    { response_id, ... }
   event: response.output_text.delta { ... }
   ...
   event: response.done       { ... }
```

Response is SSE — parse with a standard event-stream reader.

### 5.5 Gateway URL resolution

The gateway URL is per-tenant and has NO static fallback:

1. User override in `localStorage["tf_gateway_url_v1"]` (supports
   `{tenantName}` substitution).
2. Env `GATEWAY_BASE_URL` (also `{tenantName}` substitution).
3. Discovery:
   ```
   GET {cp}/api/svc/v1/llm-gateway/installations
   → 200 { "data": [ { "manifest": { "enabled": true, "name": "gateway-default", "baseUrl": "https://gw..." } } ] }
   ```
   Pick the enabled entry named `gateway-default`, else the first
   enabled. Final URL = `` `${baseUrl}/${tenantName}` ``.
4. Nothing resolved → block sends, show error toast. No silent fallback.

Cache discovery in memory for the tab's lifetime only. On tenant change
(compare against `localStorage["tf_last_tenant_v1"]`), wipe the user
override and reset the discovery cache.

---

## 6. Storage-key cheatsheet

| Key                              | Contents                                  | Scope         |
| --------------------------------- | ------------------------------------------ | ------------- |
| `tf_auth_v1`                     | Full `StoredAuth` (device mode only)      | Persistent    |
| `tf_tenant_name_v1`              | Cached tenant name hint                   | Persistent    |
| `tf_last_tenant_v1`              | Last signed-in tenant (change detection)  | Persistent    |
| `tf_gateway_url_v1`              | User's gateway-URL override               | Persistent    |
| `tf_selected_model_v1`           | User's picked `model_fqn`                 | Persistent    |
| `tf_enabled_skills_v1`           | JSON `string[]` of enabled skill FQNs     | Persistent    |
| `tf_eager_skills_v1`             | JSON `string[]` of eager skill FQNs       | Persistent    |
| `tf_agent_reasoning_effort_v1`   | `"low" \| "medium" \| "high"`             | Persistent    |
| `inMemoryPat` (module var)       | PAT for gateway (CP_AUTH only)            | Memory only   |

Rule: seed defaults from env ONLY when the key is empty. Once the user
touches a control, that choice wins forever — never re-seed on remount.
