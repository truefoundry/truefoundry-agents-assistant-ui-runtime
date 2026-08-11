# @truefoundry/assistant-ui-runtime

A headless React runtime that connects [assistant-ui](https://www.assistant-ui.com/) to any `AgentChatServer`. Bring your own UI and server — the adapter maps sessions, turns, and streaming events onto assistant-ui's external-store runtime. A TrueFoundry gateway plugin is included for first-party hosts.

Built on top of [`@assistant-ui/react`](https://www.assistant-ui.com/), so Thread, Composer, ThreadList, and tool UIs work against a familiar contract out of the box.

### Checkout the Demo [here](../../examples/assistant-ui-vite)

---

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [`useAgentRuntime` options](#useagentruntime-options)
- [Agent modes](#agent-modes)
- [Attachments](#attachments)
- [Runtime extras](#runtime-extras)
- [Server port (`AgentChatServer`)](#server-port-agentchatserver)
- [TrueFoundry agent UI server plugin](#truefoundry-agent-ui-server-plugin)
- [Exports](#exports)
- [Architecture](#architecture-source-map)
- [License](#license)

---

## Installation

```bash
npm install @truefoundry/assistant-ui-runtime @assistant-ui/react
# or
pnpm add @truefoundry/assistant-ui-runtime @assistant-ui/react
# or
yarn add @truefoundry/assistant-ui-runtime @assistant-ui/react
```

Using the built-in TrueFoundry gateway plugin? Also install the gateway SDK:

```bash
npm install truefoundry-gateway-sdk
```

**Peers:** React `^18 || ^19`, `@assistant-ui/react` in the host app, and an `AgentChatServer` implementation (plugin or your own). Bundled deps `@assistant-ui/core` and `@assistant-ui/store` are pulled in automatically.

---

## Quick start

The fastest path is the TrueFoundry gateway plugin + `useAgentRuntime` + your Thread UI.

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  createTrueFoundryAgentUIServer,
  useAgentRuntime,
} from "@truefoundry/assistant-ui-runtime";
import { Thread } from "@/components/assistant-ui/thread";

const server = await createTrueFoundryAgentUIServer({
  apiKey: process.env.TFY_API_KEY!,
  cpURL: process.env.TFY_CP_URL!,
  // gatewayURL: process.env.TFY_GATEWAY_URL, // optional
});

export function MyAssistant() {
  const runtime = useAgentRuntime({
    server,
    agentName: "support-bot",
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

That wires streaming turns, tool approvals, ask-user prompts, MCP auth, and sub-agent nesting through the runtime.

> Prefer a drop-in chat UI? Pair with [`@truefoundry/agent-ui-sdk`](https://www.npmjs.com/package/@truefoundry/agent-ui-sdk) (`AgentChat`) instead of a custom Thread.

---

## `useAgentRuntime` options

`UseAgentRuntimeOptions` extends assistant-ui's `ExternalStoreSharedOptions`. Adapter-specific fields:

| Option | Type | Required | Description |
| ------ | ---- | -------- | ----------- |
| `server` | `AgentChatServer` | ✅ | Server implementation. The runtime never reads credentials itself. |
| `agentName` | `string` | ✅\* | Saved agent to run. \*Or use `agent` for draft / explicit named mode. |
| `agent` | `NamedAgentConfig \| DraftAgentConfig` | — | Discriminated agent source. Overrides `agentName` when set. |
| `initialSessionId` | `string` | — | Pin an existing session once on mount (uncontrolled). |
| `threadId` | `string` | — | Controlled active session id; reactive and URL-syncable. |
| `onThreadIdChange` | `(threadId: string \| undefined) => void` | — | Fires when the active session changes. |
| `onError` | `(error: unknown) => void` | — | Invoked on stream / load / turn errors. |
| `adapters` | `{ attachments?, speech?, dictation?, voice?, feedback? }` | — | Optional assistant-ui adapters forwarded to the runtime. |

### Resume / pin a session

```tsx
const runtime = useAgentRuntime({
  server,
  agentName: "support-bot",
  initialSessionId: "ses_abc123",
});
```

Omit `<ThreadList>` if you manage session ids yourself — the session-list adapter only powers that UI. Each gateway session corresponds to one assistant-ui thread.

---

## Agent modes

`agent` / `agentName` control how the runtime sources the agent.

| Mode | Config | Behavior |
| ---- | ------ | -------- |
| `named` _(default)_ | `agentName` or `agent: { mode: "named", agentName }` | Runs a saved gateway agent |
| `draft` | `agent: { mode: "draft", defaultAgentSpec }` | Inline mutable `AgentSpec`, synced via draft sessions |

```tsx
// Named
const runtime = useAgentRuntime({
  server,
  agentName: "support-bot",
});

// Draft
const runtime = useAgentRuntime({
  server,
  agent: {
    mode: "draft",
    defaultAgentSpec: { model: { name: "gpt-4o" } },
    onAgentSpecChange: (spec) => console.log("spec updated", spec),
  },
});
```

---

## Attachments

Attachments are **opt-in**. Wire the built-in adapter for composer file pick / previews and gateway forwarding on send.

```tsx
import {
  agentAttachmentAdapter,
  useAgentRuntime,
} from "@truefoundry/assistant-ui-runtime";

const runtime = useAgentRuntime({
  server,
  agentName,
  adapters: { attachments: agentAttachmentAdapter },
});
```

---

## Runtime extras

Typed escape hatch for adapter-specific state and actions (same pattern as `@assistant-ui/react-google-adk`). Use selector hooks for thread-level UI; use action hooks / `agentExtras.get(aui)` inside nested sub-agent renderers.

### Approvals, ask-user, MCP auth

```tsx
import {
  useApprovals,
  useToolResponses,
  useMcpAuth,
} from "@truefoundry/assistant-ui-runtime";

const { pending, respond } = useApprovals();
const { pending: asks, respond: answer } = useToolResponses();
const { pending: mcp, resume } = useMcpAuth();
```

**Batched resume:** the gateway requires **every** pending `user.tool_approval` and `user.tool_response` across all threads (root + sub-agents) in a **single** resume call. The adapter stages decisions locally and only sends when nothing is pending anywhere — partial resumes are rejected.

### Hooks reference

| Hook | Returns | Description |
| ---- | ------- | ----------- |
| `useApprovals()` | `{ pending, respond }` | Pending tool approvals + respond |
| `useToolResponses()` | `{ pending, respond }` | Pending ask-user prompts + respond |
| `useMcpAuth()` | `{ pending, resume }` | Pending MCP OAuth + resume |
| `useRespondToToolApproval()` | `(r) => void` | Respond from any render context |
| `useRespondToToolResponse()` | `(r) => void` | Answer ask-user from any render context |
| `useResumeMcpAuth()` | `() => Promise<void>` | Resume after MCP OAuth |
| `useCancel()` | `() => Promise<void>` | Cancel the active turn |
| `useHistoryPagination()` | `{ hasOlderHistory, isLoadingOlderHistory, loadOlderHistory }` | Scroll-up older history |

### Low-level namespace

```tsx
import { agentExtras } from "@truefoundry/assistant-ui-runtime";

const extras = agentExtras.use();
const pending = agentExtras.use((e) => e.pendingApprovals, []);
```

---

## Server port (`AgentChatServer`)

The runtime never holds credentials. It accepts any object implementing `AgentChatServer` — a flat, stateless port with methods like `createSession`, `listSessions`, `createTurn`, etc.

**First-party:** use [`createTrueFoundryAgentUIServer`](#truefoundry-agent-ui-server-plugin) (requires `truefoundry-gateway-sdk`). Chat-only: `createTrueFoundryChatServer`.

**Your own backend:**

```tsx
import type { AgentChatServer } from "@truefoundry/assistant-ui-runtime";

const server: AgentChatServer = {
  createSession: async (req) => {
    /* … */
  },
  listSessions: async (req) => {
    /* … */
  },
  getSession: async (req) => {
    /* … */
  },
  updateSession: async (req) => {
    /* … */
  },
  createTurn: (req) => {
    /* return AsyncIterable<TurnStreamData> */
  },
  cancelSession: async (req) => {
    /* … */
  },
  listTurns: async (req) => {
    /* … */
  },
  getTurn: async (req) => {
    /* … */
  },
  listEvents: async (req) => {
    /* … */
  },
};
```

`ListResult<T>` is `{ data: T[]; nextPageToken?: string }` — flat token-based pagination. Optional methods: `deleteSession`, `listTurnEvents`, `subscribeToTurn`, `downloadSandboxFile`.

---

## TrueFoundry agent UI server plugin

`createTrueFoundryAgentUIServer` builds gateway chat + Control Plane builder lists from `{ apiKey, cpURL, gatewayURL? }`. Same bearer for CP and gateway.

```tsx
import { createTrueFoundryAgentUIServer } from "@truefoundry/assistant-ui-runtime";
// or
import { createTrueFoundryAgentUIServer } from "@truefoundry/assistant-ui-runtime/plugins/truefoundry-agent-server-adapter";

const server = await createTrueFoundryAgentUIServer({
  apiKey: process.env.TFY_API_KEY!,
  cpURL: process.env.TFY_CP_URL!,
});
```

Chat-only escape hatch: `createTrueFoundryChatServer({ apiKey, baseUrl })`.

See the [plugin README](./src/plugins/truefoundry-agent-server-adapter/README.md) for gateway URL resolution, builder CP paths, `Tfy*` types, and host-spec extension.

---

## Exports

| Export | Kind | Purpose |
| ------ | ---- | ------- |
| `useAgentRuntime` | Hook | Root runtime — wires external-store + thread list |
| `createTrueFoundryAgentUIServer` | Function | Full pack: gateway chat + CP builder (also via plugin subpath) |
| `createTrueFoundryChatServer` | Function | Chat-only gateway → `AgentChatServer` |
| `agentAttachmentAdapter` | Adapter | Opt-in composer attachments |
| `agentExtras` | Namespace | Low-level extras access |
| `useApprovals` / `ToolResponses` / `McpAuth` / … | Hooks | Pending state + actions |
| `AgentChatServer`, `AgentBuilderServer`, `CatalogServer`, `Session`, `Turn`, … | Types | Server ports + DTOs |
| `TfyAgentSpec`, `TfySession`, `isTfyToolInfo`, … | Types / guards | Gateway-concrete types from the plugin |
| `NamedAgentConfig`, `DraftAgentConfig` | Types | Agent source discriminants |

---

## Architecture (source map)

For contributors working inside this package. Source lives in `src/` (GitHub); the published package ships `dist/` built by `tsup`.

| File | Responsibility |
| ---- | -------------- |
| `server/types.ts` | `AgentChatServer` + `AgentBuilderServer` + `CatalogServer` (modelCatalog/connectorCatalog/skillCatalog, optional via `AgentUIServerPort.catalog`), `AgentSpec`, session/turn/pagination types |
| `server/events.ts` | Concrete turn/stream event types |
| `draft/` | Draft-mode helpers (`mergeAgentSpec`, session bridge, draft thread-list, `useDraftAgentSpec`) |
| `useAgentRuntime.ts` | Public hook — external-store + thread-list + extras |
| `useAgentMessages.ts` | Reactive session snapshot: load, stream, cancel, resume |
| `agentExtras.ts` / `hooks.ts` | Extras namespace + consumer hooks |
| `convertTurnMessages.ts` | Pure projection from snapshot → thread messages |
| `foldPeerThreads.ts` | Nest peer/sub-agent threads under spawning tool calls |
| `plugins/truefoundry-agent-server-adapter/` | Gateway chat + CP builder → `AgentUIServerPort` |

### Invariants

- One gateway **session** ⇄ one assistant-ui **thread** (`session.id` = thread `remoteId`).
- Root thread id is always `"main"` (`ROOT_THREAD_ID`); sub-agents nest under their `create_sub_agent` tool call.
- The runtime never holds credentials — only a pre-built `AgentChatServer`.
- A paused turn's resume `input` must include **all** pending approvals + tool responses across every thread in one batch.
- Two agent modes: **named** (`agentName`) and **draft** (`agent: { mode: "draft", … }`).

### Local development

```bash
pnpm build      # tsup → dist/
pnpm test       # vitest run
pnpm typecheck  # tsc --noEmit
```

### Unsupported assistant-ui features

| Feature | Notes |
| ------- | ----- |
| Attachment rendering | Forwarded on send; user bubbles show text only today |
| Speech / Dictation / Voice | Pass-through only |
| Feedback | Pass-through only; not persisted to the gateway |
| Thread rename / archive / delete | Thread-list adapter no-ops |
| Thread title generation | Returns an empty stream |

---

## License

See [LICENSE](../../LICENSE).
