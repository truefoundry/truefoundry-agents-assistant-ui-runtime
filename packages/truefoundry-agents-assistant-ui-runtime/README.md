# @truefoundry/assistant-ui-runtime

TrueFoundry agent runtime adapter for [assistant-ui](https://www.assistant-ui.com/).

Connect assistant-ui components (`Thread`, `Composer`, tool UIs, `ThreadList`) to TrueFoundry agent sessions via `useTrueFoundryAgentRuntime`. The adapter maps gateway turns and streaming events onto assistant-ui's external-store runtime, including multi-agent nesting, tool approvals, ask-user tool responses, MCP auth, batched resume, resumable streams, and composer attachment forwarding on send.

## Requirements

- **React** `^18 || ^19` (peer dependency)
- **`@assistant-ui/react`** in the host app for the UI primitives
- An **`AgentChatServer`** implementation — either use the built-in TrueFoundry gateway plugin (see below) or bring your own

Bundled deps `@assistant-ui/core` and `@assistant-ui/store` are pulled in automatically.

## Installation

```bash
npm install @truefoundry/assistant-ui-runtime @assistant-ui/react
```

If using the built-in TrueFoundry gateway adapter plugin, also install the gateway SDK:

```bash
npm install truefoundry-gateway-sdk
```

## Quickstart

### 1. Create an `AgentChatServer`

The runtime accepts any object implementing the `AgentChatServer` interface — a flat, stateless port with methods like `createSession`, `listSessions`, `prepareAndExecuteTurn`, etc. It never reads credentials itself.

Using the built-in TrueFoundry gateway plugin (requires `truefoundry-gateway-sdk`):

```tsx
import { createTrueFoundryChatServer } from "@truefoundry/assistant-ui-runtime/plugins/truefoundry-agent-server-adapter";

const server = createTrueFoundryChatServer({
  apiKey: process.env.TFY_API_KEY!,
  baseUrl: process.env.TFY_GATEWAY_URL!,
});
```

Or bring your own implementation against any backend:

```tsx
import type { AgentChatServer } from "@truefoundry/assistant-ui-runtime";

const server: AgentChatServer = {
  createSession: async (req) => { /* ... */ },
  listSessions: async (req) => { /* ... */ },
  getSession: async (req) => { /* ... */ },
  updateSession: async (req) => { /* ... */ },
  prepareAndExecuteTurn: (req) => { /* return AsyncIterable<TurnStreamData> */ },
  cancelSession: async (req) => { /* ... */ },
  listTurns: async (req) => { /* ... */ },
  getTurn: async (req) => { /* ... */ },
  listEvents: async (req) => { /* ... */ },
};
```

### 2. Set up the runtime

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useTrueFoundryAgentRuntime } from "@truefoundry/assistant-ui-runtime";
import { Thread } from "@/components/assistant-ui/thread";

export function MyAssistant() {
  const runtime = useTrueFoundryAgentRuntime({
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

### 3. Use the component

```tsx
import { MyAssistant } from "@/components/MyAssistant";

export default function Home() {
  return (
    <main className="h-dvh">
      <MyAssistant />
    </main>
  );
}
```

### 4. Set up UI components

See the assistant-ui [Thread UI guide](https://www.assistant-ui.com/docs/ui/thread) for wiring Thread, composer, and primitives.

## `useTrueFoundryAgentRuntime` options

`UseTrueFoundryAgentRuntimeOptions` extends assistant-ui's `ExternalStoreSharedOptions`. The adapter-specific fields are:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `server` | `AgentChatServer` | Yes | Server implementation. The runtime never reads credentials itself. |
| `agentName` | `string` | Yes* | Saved agent to run. *Or use `agent` for draft mode. |
| `agent` | `NamedAgentConfig \| DraftAgentConfig` | No | Discriminated agent source. Overrides `agentName` when set. |
| `initialSessionId` | `string` | No | Pin an existing session once on mount (uncontrolled). |
| `threadId` | `string` | No | Controlled active session id; reactive and URL-syncable. |
| `onThreadIdChange` | `(threadId: string \| undefined) => void` | No | Fires when the active session changes. |
| `onError` | `(error: unknown) => void` | No | Invoked on stream/load/turn errors. |
| `adapters` | `{ attachments?, speech?, dictation?, voice?, feedback? }` | No | Optional assistant-ui adapters forwarded to the runtime. |

### Specifying the agent

Named agent (saved on the gateway):

```tsx
const runtime = useTrueFoundryAgentRuntime({
  server,
  agentName: "support-bot",
});
```

Draft agent (inline spec, mutable):

```tsx
const runtime = useTrueFoundryAgentRuntime({
  server,
  agent: {
    mode: "draft",
    defaultAgentSpec: { model: { name: "gpt-4o" } },
    onAgentSpecChange: (spec) => console.log("spec updated", spec),
  },
});
```

### Adding adapters

Attachments are **opt-in**: wire the built-in adapter when you want composer file pick / previews and gateway forwarding on send.

```tsx
import { trueFoundryAttachmentAdapter, useTrueFoundryAgentRuntime } from "@truefoundry/assistant-ui-runtime";

const runtime = useTrueFoundryAgentRuntime({
  server,
  agentName,
  adapters: { attachments: trueFoundryAttachmentAdapter },
});
```

### Resuming a session

```tsx
const runtime = useTrueFoundryAgentRuntime({
  server,
  agentName,
  initialSessionId: "ses_abc123",
});
```

### Bring your own session ID (no session list)

Pin the active session with `initialSessionId` (one-time) or controlled `threadId` (reactive, URL-syncable). Omit `<ThreadList>` — the session list adapter only powers that UI.

```tsx
const runtime = useTrueFoundryAgentRuntime({
  server,
  agentName,
  initialSessionId: "ses_abc123",
});

return (
  <AssistantRuntimeProvider runtime={runtime}>
    <Thread />
  </AssistantRuntimeProvider>
);
```

Each gateway session corresponds to one assistant-ui thread.

## `AgentChatServer` interface

The runtime operates against a flat server port — no session-with-methods objects, no SDK dependency. Any backend can implement this interface:

```tsx
interface AgentChatServer {
  createSession(req: CreateSessionRequest): Promise<Session>;
  listSessions(req?: ListSessionsParams): Promise<ListResult<Session>>;
  getSession(req: { sessionId: string }): Promise<Session>;
  updateSession(req: UpdateSessionRequest): Promise<Session>;

  prepareAndExecuteTurn(req: {
    sessionId: string;
    input?: TurnInputItem[];
    previousTurnId?: PreviousTurnIdInput;
    abortSignal?: AbortSignal;
    headers?: Record<string, string>;
  }): AsyncIterable<TurnStreamData>;

  cancelSession(req: { sessionId: string }): Promise<void>;
  deleteSession?(req: { sessionId: string }): Promise<void>;

  listTurns(req: { sessionId: string; limit?: number; pageToken?: string; order?: "asc" | "desc" }): Promise<ListResult<Turn>>;
  getTurn(req: { sessionId: string; turnId: string }): Promise<Turn>;
  listEvents(req: { sessionId: string; pageToken?: string; lastTurnId?: string; limit?: number }): Promise<ListResult<SessionEventItem>>;

  listTurnEvents?(req: { sessionId: string; turnId: string; limit?: number; pageToken?: string; order?: "asc" | "desc" }): Promise<ListResult<TurnEvent>>;
  subscribeToTurn?(req: { sessionId: string; turnId: string; afterSequenceNumber?: number; abortSignal?: AbortSignal }): AsyncIterable<TurnStreamData>;
  downloadSandboxFile?(sandboxId: string, req: { path: string }): Promise<Blob>;
}
```

`ListResult<T>` is `{ data: T[]; nextPageToken?: string }` — flat token-based pagination.

### Implementing your own backend

Below is a fully-typed class implementing `AgentChatServer` against a custom REST API. Use this as a starting point when integrating your own agent backend:

```typescript
import type {
  AgentChatServer,
  CreateSessionRequest,
  ListResult,
  ListSessionsParams,
  Session,
  SessionEventItem,
  Turn,
  TurnEvent,
  TurnInputItem,
  TurnStreamData,
  UpdateSessionRequest,
} from "@truefoundry/assistant-ui-runtime";

class MyAgentChatServer implements AgentChatServer {
  constructor(private baseUrl: string, private authToken: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.authToken}`,
        ...init?.headers,
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }

  async createSession(req: CreateSessionRequest): Promise<Session> {
    return this.request("/sessions", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async listSessions(req?: ListSessionsParams): Promise<ListResult<Session>> {
    const params = new URLSearchParams();
    if (req?.limit) params.set("limit", String(req.limit));
    if (req?.pageToken) params.set("pageToken", req.pageToken);
    if (req?.agentName) params.set("agentName", req.agentName);
    return this.request(`/sessions?${params}`);
  }

  async getSession(req: { sessionId: string }): Promise<Session> {
    return this.request(`/sessions/${req.sessionId}`);
  }

  async updateSession(req: UpdateSessionRequest): Promise<Session> {
    return this.request(`/sessions/${req.sessionId}`, {
      method: "PATCH",
      body: JSON.stringify({ agentSpec: req.agentSpec, title: req.title }),
    });
  }

  prepareAndExecuteTurn(req: {
    sessionId: string;
    input?: TurnInputItem[];
    previousTurnId?: string;
    abortSignal?: AbortSignal;
  }): AsyncIterable<TurnStreamData> {
    const self = this;
    return {
      [Symbol.asyncIterator]() {
        return self.streamTurn(req);
      },
    };
  }

  private async *streamTurn(req: {
    sessionId: string;
    input?: TurnInputItem[];
    previousTurnId?: string;
    abortSignal?: AbortSignal;
  }): AsyncGenerator<TurnStreamData> {
    const res = await fetch(`${this.baseUrl}/sessions/${req.sessionId}/turns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.authToken}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        input: req.input,
        previousTurnId: req.previousTurnId,
      }),
      signal: req.abortSignal,
    });

    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6);
        if (json === "[DONE]") return;
        yield JSON.parse(json) as TurnStreamData;
      }
    }
  }

  async cancelSession(req: { sessionId: string }): Promise<void> {
    await this.request(`/sessions/${req.sessionId}/cancel`, { method: "POST" });
  }

  async listTurns(req: {
    sessionId: string;
    limit?: number;
    pageToken?: string;
  }): Promise<ListResult<Turn>> {
    const params = new URLSearchParams();
    if (req.limit) params.set("limit", String(req.limit));
    if (req.pageToken) params.set("pageToken", req.pageToken);
    return this.request(`/sessions/${req.sessionId}/turns?${params}`);
  }

  async getTurn(req: { sessionId: string; turnId: string }): Promise<Turn> {
    return this.request(`/sessions/${req.sessionId}/turns/${req.turnId}`);
  }

  async listEvents(req: {
    sessionId: string;
    pageToken?: string;
    lastTurnId?: string;
    limit?: number;
  }): Promise<ListResult<SessionEventItem>> {
    const params = new URLSearchParams();
    if (req.limit) params.set("limit", String(req.limit));
    if (req.pageToken) params.set("pageToken", req.pageToken);
    if (req.lastTurnId) params.set("lastTurnId", req.lastTurnId);
    return this.request(`/sessions/${req.sessionId}/events?${params}`);
  }

  async listTurnEvents(req: {
    sessionId: string;
    turnId: string;
    limit?: number;
    pageToken?: string;
  }): Promise<ListResult<TurnEvent>> {
    const params = new URLSearchParams();
    if (req.limit) params.set("limit", String(req.limit));
    if (req.pageToken) params.set("pageToken", req.pageToken);
    return this.request(
      `/sessions/${req.sessionId}/turns/${req.turnId}/events?${params}`,
    );
  }

  subscribeToTurn(req: {
    sessionId: string;
    turnId: string;
    afterSequenceNumber?: number;
    abortSignal?: AbortSignal;
  }): AsyncIterable<TurnStreamData> {
    const self = this;
    return {
      [Symbol.asyncIterator]() {
        return self.streamSubscribe(req);
      },
    };
  }

  private async *streamSubscribe(req: {
    sessionId: string;
    turnId: string;
    afterSequenceNumber?: number;
    abortSignal?: AbortSignal;
  }): AsyncGenerator<TurnStreamData> {
    const params = new URLSearchParams();
    if (req.afterSequenceNumber != null) {
      params.set("after", String(req.afterSequenceNumber));
    }
    const res = await fetch(
      `${this.baseUrl}/sessions/${req.sessionId}/turns/${req.turnId}/stream?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          Accept: "text/event-stream",
        },
        signal: req.abortSignal,
      },
    );

    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6);
        if (json === "[DONE]") return;
        yield JSON.parse(json) as TurnStreamData;
      }
    }
  }
}
```

Then use it with the runtime:

```tsx
const server = new MyAgentChatServer("https://api.example.com", authToken);

function App() {
  const runtime = useTrueFoundryAgentRuntime({
    server,
    agentName: "my-agent",
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Multi-agent (nested sub-agents)

TrueFoundry sub-agents are discovered at runtime via `thread.created` and nested under `ToolCallMessagePart.messages`. The gateway sends `title` on `thread.created` / `thread.done`. This runtime copies it onto `metadata.custom.subAgent.title` for the first nested message of each child thread; `name` comes from `agentInfo.name` on the same event.

Render nested threads with `MessagePartPrimitive.Messages` inside your tool fallback:

```tsx
import { MessagePartPrimitive, MessagePrimitive } from "@assistant-ui/react";
import { useAuiState } from "@assistant-ui/store";
import type { TrueFoundryMessageCustomMetadata } from "@truefoundry/assistant-ui-runtime";

function NestedSubAgentAssistantMessage() {
  const custom = useAuiState(
    (s) => s.message.metadata.custom as TrueFoundryMessageCustomMetadata,
  );
  const heading = custom.subAgent?.title ?? custom.subAgent?.name;

  return (
    <>
      {heading != null && (
        <div className="text-sm text-muted-foreground">{heading}</div>
      )}
      <MessagePrimitive.Root data-role="assistant">
        <MessagePrimitive.Parts />
      </MessagePrimitive.Root>
    </>
  );
}

<MessagePartPrimitive.Messages
  components={{
    AssistantMessage: NestedSubAgentAssistantMessage,
    UserMessage: () => null,
  }}
/>
```

See the [Multi-Agent Chat UI guide](https://www.assistant-ui.com/docs/tools/multi-agent).

## Tool approvals

When the agent requests approval, the assistant message carries a `requires-action` status and the tool-call part exposes an `approval`. Respond through assistant-ui's tool-approval UI; the adapter converts the decision back into a gateway `user.tool_approval` input and resumes the turn. Approvals on nested sub-agent threads are scoped to the correct `threadId` automatically.

For custom approval chrome (a thread-level bar instead of per-part buttons), use the extras hooks — see [Runtime extras](#runtime-extras) below.

## Ask-user tool responses (`tool.response_required`)

When the agent calls the client-side `ask_user_question` system tool, the turn ends with `tool.response_required`. The adapter marks the tool call with a human `interrupt` payload (`question`, `options`) resolved from the originating `model.message` via `ToolCallRef.sourceEventId`.

Collect the user's answer and call `respondToToolResponse({ toolCallId, content })`. The `content` string is free-form (chosen option text, typed answer, etc.).

## Batched resume (approvals + responses)

The gateway requires **every** pending `user.tool_approval` and `user.tool_response` across all threads (root + sub-agents) in a **single** `prepareTurn({ input })` call. The adapter stages decisions locally and only sends when nothing is pending anywhere:

1. User resolves all tool approvals (`respondToToolApproval`).
2. User answers all ask-user prompts (`respondToToolResponse`).
3. Runtime collects `collectRequiredActionInputs(message)` → one mixed `TurnInputItem[]` → `sendTurn({ inputs })`.

Do not send partial resumes; the backend rejects incomplete input sets.

## MCP auth

When MCP OAuth is required, the paused assistant message has `metadata.custom.pendingMcpAuth === true` and structured `metadata.custom.mcpServers` (`{ id, name, authUrl }[]`) — both fields are on `TrueFoundryMessageCustomMetadata`. After the user completes OAuth in the browser, call `resumeMcpAuth()` from extras (or `startRun` with `runConfig.custom.resumeMcpAuth: true`).

## Runtime extras

Typed escape hatch for adapter-specific state and actions — same pattern as `@assistant-ui/react-google-adk`. Read pending state with selector hooks; call actions via `trueFoundryExtras.get(aui)` when rendering inside nested sub-agent threads (readonly context).

### Read hooks (thread-level UI)

```tsx
import {
  useTrueFoundryApprovals,
  useTrueFoundryToolResponses,
  useTrueFoundryMcpAuth,
} from "@truefoundry/assistant-ui-runtime";

function ApprovalBar() {
  const { pending, respond } = useTrueFoundryApprovals();
  if (pending.length === 0) return null;

  const item = pending[0]!;
  return (
    <div>
      <p>Allow {item.toolName}?</p>
      <button onClick={() => respond({ approvalId: item.approvalId, approved: true })}>
        Allow
      </button>
      <button onClick={() => respond({ approvalId: item.approvalId, approved: false })}>
        Deny
      </button>
    </div>
  );
}

function AskUserBar() {
  const { pending, respond } = useTrueFoundryToolResponses();
  if (pending.length === 0) return null;

  const item = pending[0]!;
  return (
    <div>
      <p>{item.question ?? "Answer required"}</p>
      {(item.options ?? []).map((option) => (
        <button key={option} onClick={() => respond({ toolCallId: item.toolCallId, content: option })}>
          {option}
        </button>
      ))}
    </div>
  );
}

function McpAuthContinue() {
  const { pending, resume } = useTrueFoundryMcpAuth();
  if (pending == null) return null;

  return (
    <div>
      {pending.mcpServers.map((server) => (
        <a key={server.id} href={server.authUrl} target="_blank" rel="noreferrer">
          Authorize {server.name}
        </a>
      ))}
      <button onClick={() => void resume()}>Continue</button>
    </div>
  );
}
```

### Action hooks (any render context, including nested sub-agents)

```tsx
import {
  useTrueFoundryRespondToToolApproval,
  useTrueFoundryRespondToToolResponse,
  useTrueFoundryResumeMcpAuth,
  useTrueFoundryCancel,
} from "@truefoundry/assistant-ui-runtime";

const respondToApproval = useTrueFoundryRespondToToolApproval();
const respondToResponse = useTrueFoundryRespondToToolResponse();
const resumeMcpAuth = useTrueFoundryResumeMcpAuth();
const cancel = useTrueFoundryCancel();

respondToApproval({ approvalId, approved: true });
respondToResponse({ toolCallId, content: "Option A" });
void resumeMcpAuth();
void cancel();
```

### Hooks reference

| Hook | Returns | Description |
|------|---------|-------------|
| `useTrueFoundryApprovals()` | `{ pending, respond }` | Pending tool approvals plus a respond action. |
| `useTrueFoundryToolResponses()` | `{ pending, respond }` | Pending ask-user prompts plus a respond action. |
| `useTrueFoundryMcpAuth()` | `{ pending, resume }` | Pending MCP OAuth pause state plus a resume action. |
| `useTrueFoundryRespondToToolApproval()` | `(r) => void` | Respond to a tool approval from any render context. |
| `useTrueFoundryRespondToToolResponse()` | `(r) => void` | Respond to an ask-user prompt from any render context. |
| `useTrueFoundryResumeMcpAuth()` | `() => Promise<void>` | Resume after MCP OAuth. |
| `useTrueFoundryCancel()` | `() => Promise<void>` | Cancel the active turn. |
| `useTrueFoundryResetFromTurn()` | n/a | Re-submit a user turn (branch/reset). |
| `useTrueFoundryReload()` | n/a | Retry the current session load. |
| `useTrueFoundryHistoryPagination()` | `{ hasOlderHistory, isLoadingOlderHistory, loadOlderHistory }` | Scroll-up older history. |

### Low-level namespace

```tsx
import { trueFoundryExtras, type TrueFoundryRuntimeExtras } from "@truefoundry/assistant-ui-runtime";

const extras = trueFoundryExtras.use();
const pending = trueFoundryExtras.use((e) => e.pendingApprovals, []);
```

## Cancellation

`cancel()` calls `server.cancelSession()` and then keeps consuming the active stream: the backend closes the SSE gracefully by emitting a terminal `turn.done` event before ending the stream. No explicit reconcile is performed — the cancelled turn is terminal, and local state reconciles against the authoritative event log on the next session load.

## Resumable streams

Works out of the box — no server route or Redis store. TrueFoundry persists every turn server-side; on reload or reconnect the runtime calls `subscribeToTurn` and replays events into the fold (idempotent). Running turns are detected on session load and resumed automatically.

## History pagination

Thread open no longer drains every turn. Initial load:

1. `listTurns({ limit: 1 })` once — detect a running turn.
2. One (or a few) `listEvents` page(s) for the newest complete user-message group.
3. Clears `isLoading`, then resumes a running turn via subscribe if needed.

Older history is opt-in via `useTrueFoundryHistoryPagination()`:

```tsx
const { hasOlderHistory, isLoadingOlderHistory, loadOlderHistory } =
  useTrueFoundryHistoryPagination();

if (hasOlderHistory && !isLoadingOlderHistory) {
  void loadOlderHistory();
}
```

## Architecture (source map)

For contributors working inside this package. Source lives in `src/`; the published entry point is `dist/index.js` (built by `tsup`).

| File | Responsibility |
|------|----------------|
| `server/types.ts` | `AgentChatServer` + `AgentBuilderServer` interfaces, `Session`, `Turn`, `AgentSpec`, pagination types. |
| `server/events.ts` | Concrete turn/stream event types (`ModelMessageEvent`, `TurnCreatedEvent`, etc.). |
| `server/eventUtils.ts` | `isEventDelta()` + `mergeEventDelta()` — streaming delta merge logic. |
| `useTrueFoundryAgentRuntime.ts` | Public hook. Wires the external-store runtime, thread-list runtime, adapters, and extras. |
| `useTrueFoundryAgentMessages.ts` | Reactive `SessionSnapshot` store: load, stream ingestion, cancel, resume; derives `messages` via pure projection. |
| `sessionSnapshot.ts` | `SessionSnapshot` shape, required-actions overlay, and immutable wrapper helpers. |
| `truefoundryExtras.ts` | `createRuntimeExtras` namespace and `TrueFoundryRuntimeExtras` type. |
| `hooks.ts` | Consumer hooks — read selectors + action callbacks via `.get(aui)`. |
| `collectPending.ts` | Derives `pendingApprovals`, `pendingToolResponses`, `pendingMcpAuth` from messages. |
| `requiredActionInputs.ts` | Combined gate + `collectRequiredActionInputs` for batched resume. |
| `truefoundryThreadListAdapter.ts` | `RemoteThreadListAdapter` — cursor-paginated session list. |
| `convertTurnMessages.ts` | `projectSessionMessages` pure projector; `buildSnapshotFromSessionEvents` history ingest; stream-event aggregation. |
| `foldPeerThreads.ts` | `PeerThreadFoldState` — folds peer/sub-agent threads under their spawning tool call. |
| `streamTurn.ts` | `streamTurnContent` / `resumeTurnStream` generators over `AgentChatServer`. |
| `toolApproval.ts` | Approval state, decision mapping, and `user.tool_approval` input collection. |
| `toolResponse.ts` | Ask-user response state, staging, and `user.tool_response` input collection. |
| `listPages.ts` | `drainListPages` utility for exhausting token-paginated `ListResult` APIs. |

### Invariants

- One gateway **session** ⇄ one assistant-ui **thread** (`session.id` = thread `remoteId`).
- The root thread id is always `"main"` (`ROOT_THREAD_ID`); sub-agent threads nest beneath their `create_sub_agent` tool call.
- The runtime never holds credentials — it only accepts a pre-built `AgentChatServer`.
- Event/turn types are defined in `src/server/events.ts` (first-party, no external SDK dependency).
- A paused turn's resume `input` must include **all** pending `user.tool_approval` and `user.tool_response` events across every thread in one batch.
- Two agent modes: **named** (`agentName`) and **draft** (`agent: { mode: "draft", defaultAgentSpec }`).

## Local development

From this package directory:

```bash
pnpm build      # tsup → dist/
pnpm test       # vitest run
pnpm typecheck  # tsc --noEmit
```

`dist/` is generated output and is gitignored. From the repo root, `pnpm build` builds this package.

## Unsupported assistant-ui features

Features below are not implemented in this adapter today. Other assistant-ui capabilities (streaming, cancel, tool approval, ask-user responses, MCP auth, sub-agent nesting, resumable streams, reasoning parts) are supported.

| Feature | Notes |
|---------|-------|
| Attachment rendering | Attachments are forwarded to the gateway on send, but user message bubbles show text only. |
| Built-in `AttachmentAdapter` | Ships as `trueFoundryAttachmentAdapter` (opt-in via `adapters.attachments`). Not applied by default. |
| Speech / Dictation / Voice | Pass-through only. Not shipped. |
| Feedback | Pass-through only. Ratings are not persisted to the gateway. |
| Thread rename / archive / delete | Thread-list adapter no-ops. |
| Thread title generation | Returns an empty stream. |
