# truefoundry-agents-assistant-ui-runtime

TrueFoundry Gateway agent runtime adapter for [assistant-ui](https://www.assistant-ui.com/).

Connect assistant-ui components (`Thread`, `Composer`, tool UIs, `ThreadList`) to TrueFoundry agent sessions via `useTrueFoundryAgentRuntime`. The adapter maps gateway turns and streaming events onto assistant-ui's external-store runtime, including multi-agent nesting, tool approvals, ask-user tool responses, MCP auth, batched resume, resumable streams, and composer attachment forwarding on send.

## Requirements

- **React** `^18 || ^19` (peer dependency)
- **`truefoundry-gateway-sdk`** (peer dependency) — provides `AgentSessionClient` and agent types
- **`@assistant-ui/react`** in the host app for the UI primitives
- Bundled deps `@assistant-ui/core` and `@assistant-ui/store` are pulled in automatically

## Installation

```bash
npm install @assistant-ui/react truefoundry-agents-assistant-ui-runtime truefoundry-gateway-sdk@^0.1.0-rc.1
```

## Quickstart

### 1. Create an `AgentSessionClient`

Construct the client in your app (server module, proxy route, or demo). The runtime only accepts a pre-built client — it does **not** read API keys or gateway URLs itself.

```tsx
import { AgentSessionClient } from "truefoundry-gateway-sdk/agents";

const client = new AgentSessionClient({
  apiKey: process.env.TFY_API_KEY!,
  environment: process.env.TFY_GATEWAY_URL!, // https://gateway.truefoundry.ai/<tenant>
});
```

For production, point `fetch` or `auth` at your own backend proxy so secrets never reach the browser.

### 2. Set up the client runtime

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useTrueFoundryAgentRuntime } from "truefoundry-agents-assistant-ui-runtime";
import { Thread } from "@/components/assistant-ui/thread";

const AGENT_NAME = process.env.TFY_AGENT_NAME!;
const client = new AgentSessionClient({ /* ... */ });

export function MyAssistant() {
  const runtime = useTrueFoundryAgentRuntime({
    client,
    agentName: AGENT_NAME,
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
| `client` | `AgentSessionClient` | Yes | Pre-built gateway client. The runtime never reads credentials itself. |
| `agent` | `{ mode: "named", agentName }` \| `{ mode: "draft", defaultAgentSpec }` | Yes* | Discriminated agent source. *Or legacy `agentName` for named mode. |
| `agentName` | `string` | Named only | Legacy shorthand for `agent: { mode: "named", agentName }`. |
| `gateway` | `TrueFoundryGateway` | Draft only | Low-level gateway client for `draftSessions` CRUD. |
| `initialSessionId` | `string` | No | Pin an existing session once on mount (uncontrolled). |
| `threadId` | `string` | No | Controlled active session id; reactive and URL-syncable. |
| `onThreadIdChange` | `(threadId: string \| undefined) => void` | No | Fires when the active session changes. |
| `onError` | `(error: unknown) => void` | No | Invoked on stream/load/turn errors. |
| `adapters` | `{ attachments?, speech?, dictation?, voice?, feedback? }` | No | Optional assistant-ui adapters forwarded to the runtime. See [Unsupported assistant-ui features](#unsupported-assistant-ui-features). |

### Named agent mode (saved agent)

```tsx
const runtime = useTrueFoundryAgentRuntime({
  client,
  agent: { mode: "named", agentName: "support-bot" },
});
```

Legacy `agentName` shorthand is still supported.

### Draft agent mode (inline `AgentSpec`)

Draft mode lists **draft sessions** (`draftSessions.*`) in the thread list. Each thread's `remoteId` is a `DraftSession.id`. The runtime syncs `AgentSpec` edits via `draftSessions.update`. Turns and history use `/agents/sessions/{draftSessionId}/turns` after validating the draft via `draftSessions.get` — no separate conversation session is created.

```tsx
import { TrueFoundryGateway } from "truefoundry-gateway-sdk";
import { useTrueFoundryAgentRuntime } from "truefoundry-agents-assistant-ui-runtime";

const client = new AgentSessionClient({ apiKey, baseUrl });
const gateway = new TrueFoundryGateway({ apiKey, baseUrl });

const runtime = useTrueFoundryAgentRuntime({
  client,
  gateway,
  agent: {
    mode: "draft",
    defaultAgentSpec: {
      model: { name: "anthropic/claude-sonnet-4-6" },
      instructions: "You are a helpful assistant.",
      mcpServers: [],
      skills: [],
    },
  },
});
```

Read and update the active draft spec from UI:

```tsx
import { useTrueFoundryAgentSpec } from "truefoundry-agents-assistant-ui-runtime";

function DraftModelPicker() {
  const { agentSpec, updateAgentSpec, isSpecSyncing } = useTrueFoundryAgentSpec();
  if (agentSpec == null) return null;

  return (
    <select
      value={agentSpec.model.name}
      disabled={isSpecSyncing}
      onChange={(e) => updateAgentSpec({ model: { name: e.target.value } })}
    />
  );
}
```

`AgentSpec` maps the runtime fields from the [Agent manifest reference](https://www.truefoundry.com/docs/agent-platform/agent-harness/sdk/agent-manifest-reference) (`model`, `instructions`, `mcpServers`, `skills`, `config`, etc.). Registry metadata (`name`, `description`, `collaborators`) is not part of `AgentSpec`.

### Adding adapters

Pass optional assistant-ui adapters through `adapters`. Attachments are **opt-in**: wire the built-in adapter when you want composer file pick / previews and gateway forwarding on send.

```tsx
import { trueFoundryAttachmentAdapter, useTrueFoundryAgentRuntime } from "truefoundry-agents-assistant-ui-runtime";

const runtime = useTrueFoundryAgentRuntime({
  client,
  agentName,
  adapters: { attachments: trueFoundryAttachmentAdapter },
});
```

Other adapters (speech, feedback, etc.) follow the same pattern:

```tsx
const runtime = useTrueFoundryAgentRuntime({
  client,
  agentName,
  adapters: { attachments: trueFoundryAttachmentAdapter, speech, feedback },
});
```

### Resuming a session

```tsx
const runtime = useTrueFoundryAgentRuntime({
  client,
  agentName,
  initialSessionId: "ses_abc123",
});
```

### Bring your own session ID (no session list)

You can drive a single, externally-owned session without rendering `<ThreadList>`. Pin the active session with `initialSessionId` (one-time) or controlled `threadId` (reactive, URL-syncable). Omit `<ThreadList>` — the session list adapter only powers that UI.

```tsx
const runtime = useTrueFoundryAgentRuntime({
  client,
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

## Multi-agent (nested sub-agents)

TrueFoundry sub-agents are discovered at runtime via `thread.created` and nested under `ToolCallMessagePart.messages`. The gateway always sends `title` as a required `string` on `thread.created` / `thread.done` (never `null`). This runtime copies it onto `metadata.custom.subAgent.title` for the first nested message of each child thread; `name` comes from `agentInfo.name` on the same event.

Render nested threads with `MessagePartPrimitive.Messages` inside your tool fallback (recommended — no per-tool registration):

```tsx
import { MessagePartPrimitive, MessagePrimitive } from "@assistant-ui/react";
import { useAuiState } from "@assistant-ui/store";
import type { TrueFoundryMessageCustomMetadata } from "truefoundry-agents-assistant-ui-runtime";

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

For a collapsed tool-row header, cast the spawning `create_sub_agent` tool part’s `artifact` to `SubAgentArtifact` and read `subAgents[].title` (or `agentInfo.name`):

Alternative: register `defineToolkit({ create_sub_agent: ... })` — all sub-agents share that one system tool name.

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
} from "truefoundry-agents-assistant-ui-runtime";

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
import { useTrueFoundryRespondToToolApproval } from "truefoundry-agents-assistant-ui-runtime";

function NestedToolApprovalButton({ approvalId }: { approvalId: string }) {
  const respond = useTrueFoundryRespondToToolApproval();
  return (
    <button onClick={() => respond({ approvalId, approved: true })}>
      Allow
    </button>
  );
}
```

The action-only hooks return a single callback you can call from any render context (root or nested sub-agent thread). All four follow the same pattern:

```tsx
import {
  useTrueFoundryRespondToToolApproval,
  useTrueFoundryRespondToToolResponse,
  useTrueFoundryResumeMcpAuth,
  useTrueFoundryCancel,
} from "truefoundry-agents-assistant-ui-runtime";

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
| `useTrueFoundryApprovals()` | `{ pending: PendingApproval[]; respond: (r: RespondToToolApprovalOptions) => void }` | Pending tool approvals (across all threads) plus a respond action. Use for thread-level approval chrome. |
| `useTrueFoundryToolResponses()` | `{ pending: PendingToolResponse[]; respond: (r: RespondToToolResponseOptions) => void }` | Pending ask-user / `tool.response_required` prompts plus a respond action. |
| `useTrueFoundryMcpAuth()` | `{ pending: { mcpServers } \| null; resume: () => Promise<void> }` | Pending MCP OAuth pause state plus a resume action. |
| `useTrueFoundryRespondToToolApproval()` | `(r: RespondToToolApprovalOptions) => void` | Respond to a tool approval from any render context, including nested sub-agent (readonly) renderers. |
| `useTrueFoundryRespondToToolResponse()` | `(r: RespondToToolResponseOptions) => void` | Respond to an ask-user / `tool.response_required` prompt from any render context. |
| `useTrueFoundryResumeMcpAuth()` | `() => Promise<void>` | Resume the paused turn after the user completes MCP OAuth in the browser. |
| `useTrueFoundryCancel()` | `() => Promise<void>` | Cancel the active turn. Calls `session.cancel()` and drains the stream to its terminal `turn.done`. |
| `useTrueFoundryAgentSpec()` | `{ agentSpec, draftSessionId, isSpecSyncing, specError, updateAgentSpec }` | Draft mode only — current inline spec and debounced sync state. |
| `useTrueFoundryUpdateAgentSpec()` | `(update: AgentSpecUpdate) => void` | Draft mode only — update spec from any render context. |

Where:

- `PendingApproval` = `{ approvalId, threadId, toolName, args, argsText }`
- `PendingToolResponse` = `{ toolCallId, threadId, toolName, args, argsText, question?, options? }`
- `RespondToToolApprovalOptions` = `{ approvalId, approved, optionId?, reason? }`
- `RespondToToolResponseOptions` = `{ toolCallId, content }`

> **Read vs. action hooks.** The three `use*Approvals` / `use*ToolResponses` / `use*McpAuth` read hooks subscribe to extras state and re-render when pending items change — use them in thread-level UI (e.g. an approval bar). The four action-only hooks (`useTrueFoundryRespondTo*`, `useTrueFoundryResumeMcpAuth`, `useTrueFoundryCancel`) read the action via `trueFoundryExtras.get(aui)` and do **not** subscribe to state, so they are safe to call from nested sub-agent renderers where only a readonly context is available.

### Low-level namespace

```tsx
import { trueFoundryExtras, type TrueFoundryRuntimeExtras } from "truefoundry-agents-assistant-ui-runtime";

// Throws outside useTrueFoundryAgentRuntime:
const extras = trueFoundryExtras.use();

// Safe with fallback (returns default outside runtime):
const pending = trueFoundryExtras.use((e) => e.pendingApprovals, []);
```

`TrueFoundryRuntimeExtras` fields:

| Field | Type | Purpose |
|-------|------|---------|
| `pendingApprovals` | `PendingApproval[]` | Undecided tool approvals across all threads |
| `pendingToolResponses` | `PendingToolResponse[]` | Unanswered ask-user / client-side tool prompts |
| `pendingMcpAuth` | `{ mcpServers } \| null` | MCP OAuth pause state |
| `respondToToolApproval` | `(r: { approvalId, approved, reason? }) => void` | Stage approval; batch-send when complete |
| `respondToToolResponse` | `(r: { toolCallId, content }) => void` | Stage answer; batch-send when complete |
| `resumeMcpAuth` | `() => Promise<void>` | Resume after OAuth |
| `cancel` | `() => Promise<void>` | Cancel the active turn: calls `session.cancel()` and lets the stream drain to its terminal `turn.done` (reconciles on next session load) |
| `draft` | `TrueFoundryDraftRuntimeExtras \| null` | Draft mode only — inline `AgentSpec`, sync state, and `updateAgentSpec` |

Per-part `respondToApproval` from assistant-ui still works for root-thread tool UIs; extras complements that for global chrome and nested renderers.

## Cancellation

`cancel()` does **not** tear down the stream mid-flight. It calls `session.cancel()` and then keeps consuming the active stream: the backend closes the SSE gracefully by emitting a terminal `turn.done` event before ending the stream, so the in-flight run drains to completion on its own. No explicit reconcile is performed — the cancelled turn is terminal, and local state reconciles against the authoritative event log on the next session load (e.g. page reload). A subsequent `sendTurn` chains on the cancelled turn's history via `previousTurnId: "auto"`.

(Hard aborts still happen when *switching away* — starting a new run or changing sessions abandons the previous turn.)

## Resumable streams

Works out of the box — no server route or Redis store. TrueFoundry persists every turn server-side; on reload or reconnect the runtime calls `turn.stream({})` and replays events into the fold (idempotent). Running turns are detected on session load and resumed automatically.

> **TODO:** Track the last ingested `sequenceNumber` and pass `afterSequenceNumber` on reconnect to avoid replaying already-seen events.

Contrast with the [AI SDK resumable streams guide](https://www.assistant-ui.com/docs/guides/resumable-streams), which requires a separate encoded-byte store.

## Public API

Everything below is exported from the package root (`truefoundry-agents-assistant-ui-runtime`).

| Export | Kind | Purpose |
|--------|------|---------|
| `useTrueFoundryAgentRuntime` | hook | Main entry point. Returns an assistant-ui runtime bound to gateway sessions. |
| `UseTrueFoundryAgentRuntimeOptions` | type | Options for the hook (see table above). |
| `useTrueFoundryApprovals` | hook | `{ pending, respond }` for tool approvals via extras. |
| `useTrueFoundryToolResponses` | hook | `{ pending, respond }` for ask-user / `tool.response_required` prompts. |
| `useTrueFoundryMcpAuth` | hook | `{ pending, resume }` for MCP OAuth pause/resume. |
| `useTrueFoundryRespondToToolApproval` | hook | Action callback via `trueFoundryExtras.get(aui)` — works in nested renderers. |
| `useTrueFoundryRespondToToolResponse` | hook | Same pattern for tool responses. |
| `useTrueFoundryResumeMcpAuth` | hook | Same pattern for MCP resume. |
| `useTrueFoundryCancel` | hook | Same pattern for cancel. |
| `trueFoundryExtras` | namespace | `createRuntimeExtras` channel — `.use()`, `.get(aui)`, `.provide()`. |
| `TrueFoundryRuntimeExtras` | type | Shape provided into the runtime extras slot. |
| `PendingApproval`, `PendingToolResponse` | types | Derived pending items for UI rendering. |
| `createTrueFoundryThreadListAdapter` | fn | Builds the cursor-paginated `RemoteThreadListAdapter` powering `<ThreadList>` (`list({ after })` → `nextCursor`). Used internally; exported for custom wiring. |
| `createTrueFoundryDraftThreadListAdapter` | fn | Draft-session variant of the thread-list adapter (`draftSessions.list/create/get`). |
| `createDraftSessionBridge` | fn | Resolves a draft session id to a conversation `AgentSession` and syncs `AgentSpec` updates. |
| `mergeAgentSpec` | fn | Immutable merge helper for partial `AgentSpec` updates. |
| `AgentSpec`, `AgentSpecUpdate`, `DraftSession` | types | Gateway inline agent definition types (re-exported). |
| `getSession` | fn | `(client, sessionId) => Promise<AgentSession>` convenience wrapper. |
| `convertTurnsToThreadMessages` | fn | Loads a session's turns and folds them into assistant-ui `ThreadMessage[]` (`ConvertTurnsResult`). |
| `buildTurnAssistantContent` | fn | Folds a single turn's events into assistant content parts. |
| `repositoryItemsFromMessages` | fn | Converts messages into `ExportedMessageRepositoryItem[]` for history export. |
| `getTurnMessageContent` | fn | Extracts the text payload from an `AppendMessage`. |
| `ConvertTurnsResult` | type | Result of `convertTurnsToThreadMessages` (`messages`, `foldState`, `runningTurn?`, `unstable_resume?`). |
| `collectApprovalInputs` | fn | Collects decided approvals from a message into `user.tool_approval` inputs. |
| `collectResponseInputs` | fn | Collects staged answers into `user.tool_response` inputs. |
| `collectRequiredActionInputs` | fn | Collects both approval + response inputs once nothing is pending. |
| `messageHasPendingApprovals` | fn | True if a message still has undecided tool approvals. |
| `messageHasPendingResponses` | fn | True if a message still has unanswered tool responses. |
| `messageHasPendingRequiredActions` | fn | True if either approvals or responses are still pending. |
| `findPausedAssistantMessage` | fn | Last assistant message in `requires-action` state. |
| `toTrueFoundryApprovalInputs` | fn | Applies an approval decision and returns gateway inputs. |
| `SubAgentArtifact`, `SubAgentCustomMetadata` | types | Shapes attached to sub-agent tool calls / nested messages. |
| `TrueFoundryMessageCustomMetadata` | type | Typed keys on `ThreadMessage.metadata.custom` written by this adapter. |
| `ROOT_THREAD_ID` | const | The literal `"main"` — the gateway's root thread id. |

## Architecture (source map)

For contributors and agents working inside this package. Source lives in `src/`; the published entry point is `dist/index.js` (built by `tsup`).

| File | Responsibility |
|------|----------------|
| `useTrueFoundryAgentRuntime.ts` | Public hook. Wires the external-store runtime, thread-list runtime, adapters, and extras. |
| `useTrueFoundryAgentMessages.ts` | Reactive `SessionSnapshot` store: load, stream ingestion, cancel, resume; derives `messages` via pure projection; records approval/response decisions in overlay. |
| `sessionSnapshot.ts` | `SessionSnapshot` shape, required-actions overlay, and immutable wrapper helpers. |
| `truefoundryExtras.ts` | `createRuntimeExtras` namespace and `TrueFoundryRuntimeExtras` type. |
| `hooks.ts` | Consumer hooks — read selectors + action callbacks via `.get(aui)`. |
| `collectPending.ts` | Derives `pendingApprovals`, `pendingToolResponses`, `pendingMcpAuth` from messages. |
| `requiredActionInputs.ts` | Combined gate + `collectRequiredActionInputs` for batched resume. |
| `truefoundryThreadListAdapter.ts` | `RemoteThreadListAdapter` — cursor-paginated session list (`list({ after })` → `nextCursor`), create/fetch sessions. |
| `truefoundryDraftThreadListAdapter.ts` | Draft-session `RemoteThreadListAdapter` backed by `draftSessions.*`. |
| `draftSessionBridge.ts` | Validates draft sessions and syncs `AgentSpec`; turns use the draft id at `/agents/sessions/{draftSessionId}/turns`. |
| `useDraftAgentSpec.ts` | Debounced draft spec state + `draftSessions.update` wiring. |
| `agentSpec.ts` | `AgentSpec` helpers and `mergeAgentSpec`. |
| `convertTurnMessages.ts` | `projectSessionMessages` pure projector; `buildSnapshotFromSession` history ingest; `convertTurnsToThreadMessages` wrapper; stream-event aggregation. |
| `foldPeerThreads.ts` | `PeerThreadFoldState` — folds peer/sub-agent threads under their spawning tool call. |
| `messageCustomMetadata.ts` | `TrueFoundryMessageCustomMetadata` — typed `metadata.custom` keys for this adapter. |
| `modelMessageContent.ts` | `model.message` events → assistant content parts (text, reasoning, tool calls). |
| `streamTurn.ts` | `streamTurnContent` / `resumeTurnStream` generators over `prepareTurn`/`stream`. |
| `toolApproval.ts` | Approval state, decision mapping, and `user.tool_approval` input collection. |
| `toolResponse.ts` | Ask-user response state, staging, and `user.tool_response` input collection. |
| `askUserQuestion.ts` | `ask_user_question` detection and argument parsing. |
| `mcpAuth.ts` | MCP auth-required detection and structured authorize UI metadata. |
| `turnEventHelpers.ts` | Appends approval / response / MCP-auth status onto turn updates. |
| `createSubAgent.ts` | Detects the `create_sub_agent` system tool call. |
| `extractTurnUserText.ts` / `lastUserMessageText.ts` | Text extraction helpers. |
| `sessions.ts` | `getSession` wrapper. |
| `sessionListStartTimestamp.ts` | Default `listSessions` window (1 year). |
| `constants.ts` | `ROOT_THREAD_ID = "main"`. |
| `types.ts` / `turnStreamUpdate.ts` | Shared option and update types. |

### Invariants

- One gateway **session** ⇄ one assistant-ui **thread** (`session.id` = thread `remoteId`).
- The root thread id is always `"main"` (`ROOT_THREAD_ID`); sub-agent threads nest beneath their `create_sub_agent` tool call.
- The runtime never holds credentials — always pass a constructed `AgentSessionClient`.
- Gateway types come from `truefoundry-gateway-sdk/agents`; do not redefine event/turn shapes locally.
- A paused turn's resume `input` must include **all** pending `user.tool_approval` and `user.tool_response` events across every thread in one batch.
- Approval decisions are allow/deny only (`ApprovalDecision`); there is no `optionId` on the gateway wire.

## Local development

From this package directory:

```bash
pnpm build      # tsup → dist/
pnpm test       # vitest run
pnpm typecheck  # tsc --noEmit
```

`dist/` is generated output and is gitignored. From the repo root, `pnpm build` builds this package before the Next.js app.

## Unsupported assistant-ui features

Features below are not implemented in this adapter today. Other assistant-ui capabilities (streaming, cancel, tool approval, ask-user responses, MCP auth, sub-agent nesting, resumable streams, reasoning parts) are supported.

| Feature | Notes |
|---------|-------|
| Attachment rendering | Attachments are forwarded to the gateway on send when you provide an `AttachmentAdapter`, but user message bubbles show text only. |
| Built-in `AttachmentAdapter` | Ships as `trueFoundryAttachmentAdapter` (opt-in via `adapters.attachments`). Not applied by default. |
| Speech synthesis (`adapters.speech`) | Pass-through only. Not shipped. |
| Dictation (`adapters.dictation`) | Pass-through only. Not shipped. |
| Voice (`adapters.voice`) | Pass-through only. Not shipped. |
| Feedback (`adapters.feedback`) | Pass-through only. Ratings are not persisted to the gateway. |
| Message edit (`onEdit`) | Not wired. |
| Regenerate (`onReload`) | Not wired. |
| Message delete (`onDelete`) | Not wired. |
| Client-side tool results (`onAddToolResult`) | Not wired. |
| Tool call resume (`onResumeToolCall`) | Not wired. |
| Message queue (`queue`) | Not wired. |
| Branch switching | Not wired. |
| Thread rename / archive / delete | Thread-list adapter no-ops. |
| Thread title generation | Returns an empty stream. |
| Generative UI message parts | Not mapped from gateway events. |
| Source citation parts | Not mapped from gateway events. |
| Message import / external state | `onImport`, `onExportExternalState`, `onLoadExternalState` not wired. |
| Composer suggestions | `suggestions` not populated. |
