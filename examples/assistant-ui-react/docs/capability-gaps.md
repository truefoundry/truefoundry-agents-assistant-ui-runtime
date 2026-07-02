# assistant-ui ↔ TrueFoundry Gateway SDK: capability gaps

Indented list of assistant-ui options/concepts and whether they have a 1:1 mapping to the
TrueFoundry Gateway agent SDK (`truefoundry-gateway-sdk/agent`). Derived from the assistant-ui
type surface (`@assistant-ui/core`: `RuntimeCapabilities`, `LocalRuntimeOptionsBase`, the adapter
contracts, `ModelContext`, message part types) checked against the SDK (`AgentSessionClient`,
`CreateTurnRequest`, `CreateSessionRequest`, the `TurnStreamingEvent` union, and user/model content types).

## Scopes

Two scopes exist; this table is written against the first.

- **Saved agent (current scope).** Instructions, model, and tools are fixed server-side and the
  client references them only by `agentName`. assistant-ui currently covers just the agent name.
  Per-turn model context (system/model/tools/settings) does not apply here by definition.
- **Draft (implemented in runtime).** Instructions, model, and tools are edited per draft session
  via gateway `AgentSpec` (`draftSessions.create/get/update`). The runtime exposes spec state through
  `useTrueFoundryAgentSpec` and resolves conversation sessions for turns via `createDraftSessionBridge`.
  Items that belong to this scope are tagged **(draft scope)**.

Legend: **(none)** = no SDK source · **(partial)** = part maps, part does not · **(maps)** = clean
mapping (listed for completeness) · **(out of scope)** = not a gap; fixed by the saved-agent scope ·
**(draft scope)** = applies only to the future draft scope · **(client-only)** = handled entirely in
assistant-ui, no backend dependency.

## Hierarchy

The SDK is **server-first** (sessions, turns, events). assistant-ui is **UI-first** (threads,
messages, parts). There is no `Turn` or `Event` type in assistant-ui — those are adapter
implementation details folded into the message model during streaming.

### SDK (`truefoundry-gateway-sdk/agent`)

```
AgentSessionClient
└── Session                         conversation container; `listSessions` / `createSession` / `getSession`
    └── Turn                        linear chain via `previousTurnId`; `prepareTurn` + `execute`
        └── Event                   stream + persisted log (`TurnStreamingEvent` / `TurnEvent`)
            ├── turn.created / turn.done
            ├── model.message / model.message.delta
            ├── tool.approval_required / tool.response_required / tool.response
            ├── thread.created / thread.done   (sub-agent peer threads, keyed by `threadId`)
            └── …
```

### assistant-ui (`@assistant-ui/core` + `@assistant-ui/react`)

```
AssistantRuntime
└── Thread list                     multiple conversations; `RemoteThreadListAdapter` / `aui.threads()`
    └── ThreadListItem              metadata: id, remoteId, title, status
        └── Thread                  one active conversation; `aui.thread()`
            └── MessageRepository   messages linked by `parentId` (tree; SDK history is linear only)
                └── Message         role: user | assistant | system
                    └── Part[]      text, reasoning, tool-call, file, …
```

A **run** (composer submit → `ChatModelAdapter.run()`) is not a persisted entity in assistant-ui.
It is the action that triggers one SDK turn.

### Level mapping

| SDK | assistant-ui | Relationship |
|-----|--------------|--------------|
| **Session** | **Thread** (`remoteId`) | **(maps)** 1:1. `RemoteThreadListAdapter.initialize()` → `createSession()`; `remoteId` = `session.id`; passed to the chat adapter as `unstable_threadId`. |
| **Turn** | **Run** (implicit) | **(partial)** Not a UI type. One user send ≈ one `prepareTurn()` ≈ one user message + one assistant reply in the repository. |
| **Event** | **Message part** | **(partial)** No event type in the UI. Stream events aggregate into `ThreadMessage.content[]` (e.g. `model.message` → text / reasoning / tool-call parts). `turn.created` / `turn.done` are adapter-internal. |

### Current integration (`packages/assistant-ui-react`)

```
Session.id                  →  Thread.remoteId / unstable_threadId
Turn (prepareTurn + execute) →  One ChatModelAdapter.run()
Turn.input (user.message)   →  Last user ThreadMessage (text part)
model.message events        →  Assistant message parts (text, reasoning, tool-call)
tool.approval_required      →  requires-action + ToolFallback Allow/Deny (see Approvals)
tool.response / MCP auth    →  Partially wired (MCP auth); tool results on reload TBD
```

### Structural differences

- **Turn is server-side only in assistant-ui.** Reloading history means reconstructing messages from
  `listTurns()` + `listEvents()` via `ThreadHistoryAdapter.load()`, not exposing turns in the UI.
- **Events are finer-grained than parts.** One `model.message` event can yield multiple parts; deltas
  merge before yield (`streamTurn.ts`).
- **assistant-ui can branch; SDK turns are linear.** Messages use `parentId` for edit/regenerate
  branches; SDK turns chain via `previousTurnId` only.
- **Sub-agents nest differently.** SDK: peer threads via `thread.created` + `threadId`. assistant-ui:
  nested under `ToolCallMessagePart.messages` — see Sub-agents.

## Message content parts

- Assistant output (`ThreadAssistantMessagePart`)
  - `text` — **(maps)** ← `model.message` content (string / text parts).
  - `reasoning` — **(maps)** ← `model.message.thinkingBlocks`.
  - `tool-call` — **(maps)** ← `model.message.toolCalls` (`id`, `function.name`, `function.arguments`).
  - `source` — citations (url/document) **(none)**; `ModelMessageEventContentOneItem` is text/refusal only.
  - `generative-ui` — JSON UI spec + component allowlist **(none)**.
  - `image` — assistant-produced image **(none)**.
  - `file` — assistant-produced file **(none)**.
  - `data` — arbitrary data part **(none)**.
  - `audio` — assistant audio **(partial)**; `ModelMessageEvent.audio` is only `{ id }`, no fetchable bytes.
- User input (`ThreadUserMessagePart`)
  - `text` — **(maps)** ← `TextContentPart`.
  - `image` / `file` — **(partial)** ← `FileUploadContentPart` (`UserMessageContentOneItem = TextContentPart | FileUploadContentPart`); a single file-upload shape, no dedicated image/audio input types.
  - `audio` — user audio input **(none)**.
  - `data` — **(none)**.

## Runtime capabilities (`RuntimeCapabilities` flags)

- `cancel` — **(maps)** ← `session.cancel()`.
- `reload` (regenerate) — **(partial)**; can run a new turn, but it is not a UI branch (SDK history stays linear).
- `edit` (edit a prior message + rerun) — **(none)**; requires branching.
- `switchToBranch` / `switchBranchDuringRun` — **(none)**; SDK turns are a linear `previousTurnId` chain, no branch model.
- `delete` (delete a message) — **(none)**; no message-delete endpoint.
- `feedback` — **(none)**; see Adapters.
- `speech` / `dictation` / `voice` — **(none)**; see Adapters.
- `attachments` — **(partial)**; see Adapters.
- `unstable_copy` — **(client-only)**; copy-to-clipboard, no backend dependency.
- `queue` (`unstable_enableMessageQueue`) — **(client-only)**; composer queue held and sent on settle.

## Adapters (`LocalRuntimeOptionsBase.adapters`)

- `feedback` (`FeedbackAdapter.submit`) — thumbs up/down **(none)**; `AgentSessionClient` has no feedback endpoint/event.
- `suggestion` (`SuggestionAdapter.generate`) — follow-up prompts **(none)**; SDK emits no suggestions.
- `speech` (`SpeechSynthesisAdapter.speak`) — TTS **(none)**.
- `dictation` (`DictationAdapter.listen`) — STT **(none)**.
- `voice` (`RealtimeVoiceAdapter`) — realtime voice **(none)**.
- `attachments` (`AttachmentAdapter`: `add`/`remove`/`send`, `accept`) — **(partial)**; uploads map to `FileUploadContentPart`, but the adapter's lifecycle (pending/upload/remove) has no SDK counterpart and only the file-upload content shape is accepted.
- `history` (`ThreadHistoryAdapter`) — **(partial)**
  - `load()` — **(partial-maps)**; reconstructable from `listTurns()` + `listEvents()` as a linear repository. See [History loading & scroll](#history-loading--scroll).
  - `append` / `update` / `delete` — **(none)**; no per-message write API. Turns persist server-side by running them; branch-aware (tree) history is unrepresentable.
  - `resume` — **(partial)**; turn re-subscribe exists (`turn.stream({ afterSequenceNumber })`), but not shaped as the adapter's resume. See [History loading & scroll](#history-loading--scroll).

## History loading & scroll

Limitations of the current `packages/assistant-ui-react` integration and of assistant-ui's
history contract. Scroll position does **not** trigger fetches.

### Bulk history load (no scroll-based pagination)

`ThreadHistoryAdapter.load()` is a **single bulk import**: the runtime calls it once on thread open
and does `repository.import(repo)` with the full message tree. There is no `loadMore()`, cursor, or
scroll hook on the history adapter — assistant-ui does not support "scroll up → fetch older
messages" within a thread out of the box.

The current TrueFoundry adapter (`loadSessionHistory.ts`) follows that contract:

- **`listTurns()`** — all turns for the session, sorted client-side.
- **Per completed turn** — **`turn.listEvents({ order: "asc" })`** iterated to completion;
  `collectRootModelMessage()` keeps the last root-thread `model.message` but still walks the full
  event log for that turn.
- **Running turn** — loop stops before that turn's events; only the user message is imported;
  `unstable_resume: true` + `runningTurn` are returned so the runtime auto-starts `history.resume()`.

Nothing is fetched lazily as the user scrolls the message viewport.

### What assistant-ui *does* load progressively

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| Active run | `ChatModelAdapter.run()` / `history.resume()` yields | Current assistant reply (tokens/parts) |
| Thread list | `RemoteThreadListAdapter.list({ after })` + `ThreadListPrimitive.LoadMore` / `aui.threads().loadMore()` | Sidebar **sessions**, not in-thread messages |
| Render deferral | CSS `content-visibility: auto` on messages (`thread.tsx`) | Browser paint/layout only; data already in memory |

There is **no** built-in "scroll up → fetch older messages" primitive. Even the first-party
`AssistantCloudThreadHistoryAdapter` uses a single bulk `load()` on thread open — same contract as
our TrueFoundry adapter.

Related assistant-ui pieces that are **not** scroll-based history fetch:

- **`ThreadListPrimitive.LoadMore`** — paginates the thread **list** (more sessions), not messages
  inside the open chat. Wired in `thread-list.tsx` via `ThreadListLoadMore`; backed by
  `createTrueFoundryThreadListAdapter` cursor pagination (`list({ after })` → `nextCursor`).
- **`unstable_useThreadMessageIds` + `ThreadPrimitive.Unstable_MessageById`** — experimental hooks
  to drive a **virtualized or custom message list** (see below). Pair with your own virtual scroller
  (e.g. react-virtuoso); assistant-ui does not ship a virtual list component.
- **`thread.import()` / `useExternalStoreRuntime`** — escape hatch to prepend messages you fetched
  yourself; no scroll listener or adapter method is provided.

To add scroll-based in-thread history, you would need a custom approach (e.g. partial `load()` +
manual prepend via `ExternalStoreAdapter`) — not wired today.

### Virtualization vs progressive history (in memory)

These are easy to confuse:

| Mechanism | All messages in memory? | What it optimizes |
|-----------|-------------------------|-------------------|
| **Bulk `history.load()`** (current) | Yes — full `thread.messages` repository | Network: fetches all turns/events upfront |
| **Virtualization** (`Unstable_MessageById` + external virtual list) | Yes — same repository | DOM: mounts React trees only for visible rows |
| **CSS `content-visibility: auto`** (current `thread.tsx`) | Yes — all messages mounted | Paint: browser skips layout/paint for off-screen nodes |

Virtualization does **not** fetch from the gateway. `unstable_useThreadMessageIds()` reads
`s.thread.messages` — whatever was already imported. Off-screen messages stay in the runtime store;
their components are simply not mounted (or are unmounted as you scroll).

**Current app:** uses default `ThreadPrimitive.Messages`, which renders **every** message (no
virtualization). History still loads entirely via `loadSessionHistory()` before display.

### Running-turn resume

When `turn.state.status === "running"` on reload:

1. History import includes the user message only (no assistant bubble from persisted events).
2. Local runtime calls `TrueFoundryThreadHistoryAdapter.resume()` → `turn.stream({})`.
3. Partial assistant text appears only as the live stream delivers events, not from a pre-load of
   `listEvents()`.

Cancel during resume aborts the stream and calls `turn.session.cancel()`.

### Scroll during streaming (viewport only)

The thread uses `turnAnchor="top"` on `ThreadPrimitive.Viewport`. With that setting, assistant-ui
defaults **`autoScroll` to false** and skips **`scrollToBottomOnRunStart`** for resume runs.

If the user scrolls up while a run or resume is active:

- Scroll position is preserved; new tokens grow below, out of view.
- The "scroll to bottom" control appears when not at bottom.
- The run continues; scroll does not pause or cancel it.
- Clicking scroll-to-bottom re-attaches the viewport to the live tail.

This is viewport behavior only — no additional API calls.

## Model context, tools & run config

In the **saved-agent** scope these are fixed server-side, so they are out of scope. In the **draft**
scope each becomes a live mapping target (pending an SDK surface for inline agent definition).

- `ModelContext.system` (per-turn system prompt) — saved agent: **(out of scope)**; draft: **(maps)** ← `AgentSpec.instructions` via `useTrueFoundryAgentSpec`.
- `ModelContext.callSettings` (`temperature`, `topP`, `maxTokens`, penalties, `seed`) — saved agent: **(out of scope)**; draft: **(maps)** ← `AgentSpec.model.params`.
- `ModelContext.config` (`modelName`, `apiKey`, `baseUrl`, `reasoningEffort`) — saved agent: **(out of scope)**; draft: **(maps)** ← `AgentSpec.model.name` + `model.params.reasoningEffort`.
- `ModelContext.tools` / client-registered tools (`useAui` toolkit → `context.tools`) — saved agent: **(out of scope)**; draft: **(maps)** ← `AgentSpec.mcpServers` + `skills`. (Client-executed frontend tools still run in assistant-ui regardless, but are not advertised to the backend model.)
- `RunConfig.custom` / `unstable_composerMetadata` (per-run custom metadata) — **(none)**; no metadata field on `createTurn` in either scope.

## Multi-thread / thread list (`RemoteThreadListAdapter`)

- `list` — **(maps)** ← `client.listSessions()` (paginated).
- `initialize` — **(maps)** ← `client.createSession({ agentName })` (named) or `draftSessions.create({ agentSpec })` (draft).
- `fetch` — **(maps)** ← `client.getSession()`.
- `rename` — **(none)**; no session-mutation endpoint.
- `archive` / `unarchive` — **(none)**; no archive concept.
- `delete` — **(none)**; no session-delete endpoint.
- `generateTitle` — **(none)**; SDK assigns the title itself (`thread.created.title`).
- `updateCustom` — **(none)**; no per-session custom-metadata store.

## Approvals / human-in-the-loop

SDK: `tool.approval_required` → user replies with `UserToolApprovalEvent { toolCallId, approval }`,
where `ApprovalDecision = ApprovalAllow { status: "allow" } | ApprovalDeny { status: "deny", reason? }`.
assistant-ui: native `ToolFallback` Allow/Deny → `respondToApproval({ approved, reason? })`.

### Wired (native assistant-ui only)

- `tool.approval_required` → `{ status: requires-action, reason: tool-calls }` + `approval: { id }` on tool-call parts — **(maps)** via `turnEventStream.ts` / `loadSessionHistory.ts`.
- Allow / Deny resume → `prepareTurn({ input: [UserToolApprovalEvent, …] })` — **(maps)** via `collectApprovalInputs` + `streamTurn.ts` + `TrueFoundryAgentRuntimeProvider.tsx`. LocalRuntime waits until every pending approval is decided; the adapter sends **one** bulk `input` array (no per-click SDK roundtrip).
- History reload mid-approval → buttons restored from `turn.state.requiredActions` — **(maps)** via `appendToolApprovalToTurnContent`.
- Doc-flow script — `pnpm tool-approval`.

### Capability matrix

- Single **Allow / Deny** — **(maps)**; boolean ↔ `ApprovalDecision` allow/deny; `approval.id` ↔ `UserToolApprovalEvent.toolCallId`. Deny `reason` is supported on the wire (`ApprovalDeny.reason`) but native `ToolFallback` does not collect a reason textarea (binary Deny only).
- Human-tool result path (`addResult(string)`, no `approval`) — **(maps)** ← `tool.response_required` → `UserToolResponseEvent.content` (string). Separate feature; not part of approval gates.
- Multi-option approvals (`approval.options`: `allow-always` / `reject-always` / custom kinds, `grants`, `respondToApproval({ optionId })`) — **(none)**; SDK `ApprovalDecision` is binary allow/deny only — no "always", scoped grants, or option ids. `ToolFallback` can render options if the host supplies them, but this integration does not emit `approval.options`.
- Per-tool custom approval UI (`makeAssistantToolUI` / toolkit `render` with bespoke Allow/Deny chrome) — **(out of scope)**; use default `ToolFallback` only.
- Note: in the LocalRuntime gate flow, Deny synthesizes a client-side error result (`{ error: reason }`); the SDK conveys denial as `{ status: "deny", reason }` and the gateway surfaces it to the model. Compatible, different mechanism.

### Not wired (follow-ups)

- Pending approval on **running** turn reload (`history.resume()`) — follow-up after basic live + completed-turn reload work.
- Deny with custom reason from UI — needs non-native reason input; SDK supports `ApprovalDeny.reason`.

## Tool UI / code execution

- Default tool rendering (`ToolFallback`) — **(maps)**; renders any tool call as collapsible name + `argsText`/`result` `<pre>` blocks + approval buttons. A code-execution tool call shows args/output as plain preformatted text (no syntax highlighting, no run/output panes).
- Dedicated code-execution / interpreter component — **(none)**; assistant-ui ships none. A rich code+output UI requires a custom tool component (`makeAssistantToolUI` / a `ToolCallMessagePartComponent`), reusing the markdown `CodeBlock` for highlighting.
- `SandboxHost` / MCP apps — **(separate concept)**; `SandboxHost` is an iframe *security* sandbox (`safe-content-frame`) for rendering untrusted HTML, used by MCP apps (`ToolCallMessagePart.mcp.app`, `ui://` resources). Not a code-interpreter display.
- SDK `sandbox.created` (`SandboxCreatedEvent`) — **(none)**; no dedicated renderer; would be log-only or surfaced via a custom tool UI.

## Sub-agents

- assistant-ui nests sub-agent conversations under `ToolCallMessagePart.messages`; the SDK emits peer threads keyed by `threadId`. **(maps, with transform)**
  - Deterministic fold via `ThreadCreatedEvent.parent = { threadId, toolCallId }` (+ `agentInfo`); structurally different but losslessly convertible.
- Per-sub-agent toolkit registration (`defineToolkit` / `invoke_researcher`-style tool UIs) — **(not used)**. The [multi-agent doc](https://www.assistant-ui.com/docs/tools/multi-agent) assumes named tools known at build time; TrueFoundry sub-agents come through a single system tool (`create_sub_agent`, see `createSubAgent.ts`) and are created dynamically at runtime, so there is no fixed set to register. Nested threads render via `MessagePartPrimitive.Messages` inside the shared `ToolFallback` instead.
