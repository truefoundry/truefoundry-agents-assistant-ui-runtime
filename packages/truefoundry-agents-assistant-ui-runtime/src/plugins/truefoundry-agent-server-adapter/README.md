# truefoundry-agent-server-adapter

A gateway plugin that wraps [`truefoundry-gateway-sdk`](https://www.npmjs.com/package/truefoundry-gateway-sdk) into an [`AgentChatServer`](../../README.md#server-port-agentchatserver) for `@truefoundry/assistant-ui-runtime`.

Named vs draft session routing is internal — you pass `apiKey` / `baseUrl` (or pre-built clients) and get a flat server the runtime can call.

### Used by the [runtime Quick start](../../README.md#quick-start)

---

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [`createTrueFoundryChatServer` options](#createtruefoundrychatserver-options)
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

## Quick start

```tsx
import { createTrueFoundryChatServer } from "@truefoundry/assistant-ui-runtime";
// Isolated import (no React):
// import { createTrueFoundryChatServer } from "@truefoundry/assistant-ui-runtime/plugins/truefoundry-agent-server-adapter";

const server = createTrueFoundryChatServer({
  apiKey: process.env.TFY_API_KEY!,
  baseUrl: process.env.TFY_GATEWAY_URL!,
});

// Pass `server` to useTrueFoundryAgentRuntime({ server, agentName })
```

That returns a `TrueFoundryChatServer` implementing `AgentChatServer` with concrete `TfySession` / `TfyTurn` types.

---

## `createTrueFoundryChatServer` options

| Option | Type | Required | Description |
| ------ | ---- | -------- | ----------- |
| `apiKey` | `string` | ✅ | TrueFoundry API key |
| `baseUrl` | `string` | ✅ | Gateway base URL |
| `client` | `AgentSessionClient` | — | Override the named-session client (otherwise built from `apiKey` / `baseUrl`) |
| `privateClient` | `PrivateAgentSessionClient` | — | Override the draft/private client |
| `deleteSession` | `(req: { sessionId: string }) => Promise<void>` | — | Optional delete hook — not on the gateway SDK today; pass your own if needed |

```tsx
const server = createTrueFoundryChatServer({
  apiKey,
  baseUrl,
  // client, privateClient, deleteSession — optional overrides
});
```

Escape hatch for hosts that still need raw gateway clients:

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

> Ensure `createSession` or `listSessions` ran before `getSession` / turn methods for a given id — the adapter must have cached the session type.

---

## Types & guards

The plugin surfaces concrete gateway types for hosts that need them:

```tsx
import type {
  TfyAgentSpec,
  TfySkillMount,
  TfyMcpServerMount,
  TfySession,
  TfyTurn,
  TfyTurnState,
  TfyToolInfo,
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

Use the type guards to narrow event fields typed as `unknown` by the runtime.

---

## Extending `TfyAgentSpec`

Only the **spec** is generic. Session / turn / list-params stay as concrete `Tfy*` types. Host-added spec fields survive the round trip because the gateway SDK serializes with `unrecognizedObjectKeys: "passthrough"`:

```tsx
import {
  createTrueFoundryChatServer,
  type TfyAgentSpec,
  type TrueFoundryChatServer,
} from "@truefoundry/assistant-ui-runtime";

interface MySpec extends TfyAgentSpec {
  workspaceId: string;
  deploymentId: string;
}

const server: TrueFoundryChatServer<MySpec> = createTrueFoundryChatServer<MySpec>({
  apiKey,
  baseUrl,
});

const session = await server.getSession({ sessionId: "ses_abc" });
console.log(session.agentSpec?.workspaceId); // string | undefined
```

---

## Exports

| Export | Kind | Purpose |
| ------ | ---- | ------- |
| `createTrueFoundryChatServer` | Function | Build a `TrueFoundryChatServer` from gateway credentials / clients |
| `CreateTrueFoundryChatServerOptions` | Type | Options bag above |
| `TrueFoundryChatServer<TSpec>` | Type | `AgentChatServer` + `getGatewayClients()` |
| `TfyAgentSpec`, `TfySession`, `TfyTurn`, … | Types | Concrete gateway DTOs |
| `isTfyToolInfo`, `getTfyUsage`, … | Guards / helpers | Narrow / extract gateway event fields |

Import path:

```ts
"@truefoundry/assistant-ui-runtime/plugins/truefoundry-agent-server-adapter"
```

(or the main `@truefoundry/assistant-ui-runtime` entry, which re-exports these symbols).

---

## License

See [LICENSE](../../../../LICENSE).
