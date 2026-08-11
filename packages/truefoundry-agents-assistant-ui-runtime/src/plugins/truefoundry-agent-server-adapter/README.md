# truefoundry-agent-server-adapter

TrueFoundry **agent UI server** for `@truefoundry/assistant-ui-runtime`: gateway chat + Control Plane builder lists.

- **Preferred:** `createTrueFoundryAgentUIServer` — chat + builder from `{ apiKey, cpURL, gatewayURL? }`
- **Chat-only escape hatch:** `createTrueFoundryChatServer` — gateway sessions only (CLI / tests)

The same API key bearer is used for Control Plane and gateway.

### Used by the [runtime Quick start](../../README.md#quick-start)

---

## Table of contents

- [Installation](#installation)
- [Quick start (full pack)](#quick-start-full-pack)
- [`createTrueFoundryAgentUIServer` options](#createtruefoundryagentuiserver-options)
- [Gateway URL resolution](#gateway-url-resolution)
- [Builder methods](#builder-methods)
- [Chat-only: `createTrueFoundryChatServer`](#chat-only-createtruefoundrychatserver)
- [Named vs draft sessions](#named-vs-draft-sessions)
- [Types & guards](#types--guards)
- [Extending `TfyAgentSpec`](#extending-tfyagentspec)
- [Exports](#exports)
- [License](#license)

---

## Installation

Shipped as a subpath of the runtime package (also re-exported from the main entry):

```bash
npm install @truefoundry/assistant-ui-runtime truefoundry-gateway-sdk
# or
pnpm add @truefoundry/assistant-ui-runtime truefoundry-gateway-sdk
# or
yarn add @truefoundry/assistant-ui-runtime truefoundry-gateway-sdk
```

`truefoundry-gateway-sdk` is an optional peer of the runtime — required only when using this plugin.

---

## Quick start (full pack)

```tsx
import { createTrueFoundryAgentUIServer } from "@truefoundry/assistant-ui-runtime";
// Isolated import (no React):
// import { createTrueFoundryAgentUIServer } from "@truefoundry/assistant-ui-runtime/plugins/truefoundry-agent-server-adapter";

const server = await createTrueFoundryAgentUIServer({
  apiKey: process.env.TFY_API_KEY!,
  cpURL: process.env.TFY_CP_URL!,
  // gatewayURL: process.env.TFY_GATEWAY_URL, // optional
});

// Pass `server` to TrueFoundryAssistantUI / useAgentRuntime
```

Returns `TrueFoundryAgentUIServer` = `AgentChatServer` & `AgentBuilderServer` (no settings `catalog`). Concurrent calls with the same credentials share one in-flight promise.

---

## `createTrueFoundryAgentUIServer` options

| Option | Type | Required | Description |
| ------ | ---- | -------- | ----------- |
| `apiKey` | `string` | ✅ | Bearer for CP and gateway (same PAT) |
| `cpURL` | `string` | ✅ | Control Plane base URL (builder lists + optional `/session`) |
| `gatewayURL` | `string` | — | Gateway base URL; when omitted, resolved via CP session (see below) |

---

## Gateway URL resolution

1. If `gatewayURL` is set → use it (no `/session` call)
2. Else `GET {cpURL}/api/svc/v1/session` → `{cpURL}{env.LLM_GATEWAY_URL ?? "/api/llm"}/{tenantName}`
3. If session fails or `tenantName` is missing → **throws** (no silent public-gateway fallback)

Pass a public gateway explicitly when needed, e.g. `https://gateway.truefoundry.ai/<tenant>`.

---

## Builder methods

Implemented against Control Plane HTTP (not the gateway SDK):

| Method | CP path |
| ------ | ------- |
| `getModels` | `GET /api/svc/v1/llm-gateway/model/enabled` |
| `getSkills` | `GET /api/ml/v1/agent-skills?include_empty_agent_skills=false` |
| `getMcp` | `GET /api/svc/v1/mcp-servers` |
| `searchAgents` | `GET /api/svc/v1/agents?type=truefoundry-agent&…` |
| `saveAgent` | `PUT /api/svc/v1/agents` (`{ manifest }`, upsert by name) |

Selector rows include TFY mount fields (`apiModel`, skill `fqn`, `mcpName`).

---

## Chat-only: `createTrueFoundryChatServer`

For CLI / tests that only need sessions:

```tsx
import { createTrueFoundryChatServer } from "@truefoundry/assistant-ui-runtime";

const server = createTrueFoundryChatServer({
  apiKey: process.env.TFY_API_KEY!,
  baseUrl: process.env.TFY_GATEWAY_URL!,
});
```

| Option | Type | Required | Description |
| ------ | ---- | -------- | ----------- |
| `apiKey` | `string` | ✅ | TrueFoundry API key |
| `baseUrl` | `string` | ✅ | Gateway base URL |
| `client` | `AgentSessionClient` | — | Override the named-session client |
| `privateClient` | `PrivateAgentSessionClient` | — | Override the draft/private client |
| `deleteSession` | `(req: { sessionId: string }) => Promise<void>` | — | Optional delete hook |

```tsx
const { client, privateClient } = server.getGatewayClients();
```

---

## Named vs draft sessions

Routing is fully internal via an in-memory session-type cache populated by `createSession` / `listSessions`:

| Create with | Session kind | Client used |
| ----------- | ------------ | ----------- |
| `agentName` | Named (immutable) | `AgentSessionClient` |
| `agentSpec` | Draft (mutable) | `PrivateAgentSessionClient` |

`updateSession` is only allowed when `session.isMutable === true` (draft). Calling it on a named session throws.

---

## Types & guards

```tsx
import type {
  TfyAgentSpec,
  TfySkillMount,
  TfyMcpServerMount,
  TfySession,
  TfyTurn,
  TfyModelSelectorEntry,
  TfySkillSelectorEntry,
  TfyConnectorSelectorEntry,
} from "@truefoundry/assistant-ui-runtime";

import {
  isTfyToolInfo,
  isTfySystemToolInfo,
  isTfyMcpToolInfo,
  getTfyUsage,
  getTfyThreadState,
  getTfyMcpInitServers,
} from "@truefoundry/assistant-ui-runtime";
```

---

## Extending `TfyAgentSpec`

Only the **spec** is generic. Session / turn / list-params stay as concrete `Tfy*` types. Host-added spec fields survive the round trip because the gateway SDK serializes with `unrecognizedObjectKeys: "passthrough"`:

```tsx
import {
  createTrueFoundryAgentUIServer,
  type TfyAgentSpec,
  type TrueFoundryAgentUIServer,
} from "@truefoundry/assistant-ui-runtime";

interface MySpec extends TfyAgentSpec {
  workspaceId: string;
}

const server: TrueFoundryAgentUIServer<MySpec> =
  await createTrueFoundryAgentUIServer<MySpec>({
    apiKey,
    cpURL,
  });
```

---

## Exports

| Export | Kind | Purpose |
| ------ | ---- | ------- |
| `createTrueFoundryAgentUIServer` | Function | Full pack: chat + builder |
| `CreateTrueFoundryAgentUIServerOptions` | Type | Options bag |
| `TrueFoundryAgentUIServer<TSpec>` | Type | Chat + builder result |
| `createTrueFoundryChatServer` | Function | Chat-only escape hatch |
| `TrueFoundryChatServer<TSpec>` | Type | Chat-only result |
| `TfyModelSelectorEntry`, … | Types | Builder selector rows |
| `TfyAgentSpec`, `TfySession`, `TfyTurn`, … | Types | Concrete gateway DTOs |
| `isTfyToolInfo`, `getTfyUsage`, … | Guards | Narrow gateway event fields |

Import path:

```ts
"@truefoundry/assistant-ui-runtime/plugins/truefoundry-agent-server-adapter"
```

(or the main `@truefoundry/assistant-ui-runtime` entry).

---

## License

See [LICENSE](../../../../LICENSE).
