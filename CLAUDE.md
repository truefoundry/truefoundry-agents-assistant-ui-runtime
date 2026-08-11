# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Server-centric agent runtime adapter for [assistant-ui](https://www.assistant-ui.com/). This is a pnpm monorepo with the published runtime package and demo apps. Core API talks to `AgentChatServer`; TrueFoundry is an optional plugin.

```
AgentChatServer (your backend or createTrueFoundryAgentUIServer)
  → packages/truefoundry-agents-assistant-ui-runtime (useAgentRuntime)
    → @assistant-ui/react (primitives, ExternalStoreRuntime)
      → examples/assistant-ui-vite / examples/ink-cli
```

- `packages/truefoundry-agents-assistant-ui-runtime` — headless runtime adapter. Maps `AgentChatServer` sessions/turns/streaming events onto assistant-ui's external-store runtime. No UI. Plugin: `plugins/truefoundry-agent-server-adapter/`.
- `examples/assistant-ui-vite` — Vite + React demo against a live gateway agent.
- `examples/ink-cli` — terminal chat demo via Ink.

`truefoundry-gateway-sdk` is an optional peer (required only for the TrueFoundry plugin) providing `AgentSessionClient`/`TrueFoundryGateway` and gateway event/turn types — never redefine those shapes locally outside the plugin.

### External references

- [assistant-ui `AssistantRuntime` API reference](https://www.assistant-ui.com/docs/api-reference/runtimes/assistant-runtime) — the interface `useAgentRuntime` implements (external-store runtime contract, thread-list runtime, etc.).
- [TrueFoundry `useAgent` SDK docs](https://www.truefoundry.com/docs/agent-platform/agent-harness/sdk/use-agent) — gateway-side session/turn/streaming API used by the TrueFoundry plugin.

## Commands

Run from the repo root:

| Command | Description |
|---------|-------------|
| `pnpm install` | Install workspace deps |
| `pnpm build` | Build `agent-ui-sdk` and its dependencies (`tsup → dist/`) |
| `pnpm test` | Run the runtime package's vitest suite |
| `pnpm typecheck` | Type-check all `packages/*` (`tsc --noEmit`) |
| `pnpm dev` | Build, then start the Vite example at `http://localhost:5173` |

Scoped to one package (from repo root):

```bash
pnpm --filter truefoundry-agents-assistant-ui-runtime test
pnpm --filter @truefoundry/agent-ui-sdk test
pnpm --filter @truefoundry/agent-ui-sdk build
pnpm --filter @truefoundry/agent-ui-sdk typecheck
pnpm --filter assistant-ui-vite dev
```

Run a single test file (vitest, from inside the package directory):

```bash
cd packages/truefoundry-agents-assistant-ui-runtime
npx vitest run src/toolApproval.test.ts
```

The demo app needs credentials in `.env` (`VITE_TFY_API_KEY`, `VITE_TFY_CP_URL`; optional `VITE_TFY_GATEWAY_URL`, `VITE_TFY_AGENT_NAME`) — see `examples/assistant-ui-vite/README.md`.

## Architecture

### `packages/truefoundry-agents-assistant-ui-runtime`

Full source map and invariants are documented in that package's [README](packages/truefoundry-agents-assistant-ui-runtime/README.md#architecture-source-map) — read it before making non-trivial changes here. Key invariants:

- One gateway **session** ⇄ one assistant-ui **thread** (`session.id` = thread `remoteId`).
- Root thread id is always `"main"` (`ROOT_THREAD_ID`); sub-agent threads nest beneath their `create_sub_agent` tool call.
- The runtime never holds credentials — it only ever accepts a pre-built `AgentChatServer`.
- A paused turn's resume `input` must include **all** pending `user.tool_approval` and `user.tool_response` events across every thread (root + sub-agents) in a single `prepareTurn` call — partial resumes are rejected by the backend.
- Supports two agent modes: **named** (`agent: { mode: "named", agentName }`, saved agent) and **draft** (`agent: { mode: "draft", defaultAgentSpec }`, inline `AgentSpec` synced via draft session update).
- Two agent-source modes surface as two different thread-list adapters: `threadListAdapter.ts` (named/conversation sessions) vs `draft/draftThreadListAdapter.ts` (draft sessions).
- `agentExtras.ts` / `hooks.ts` expose pending approvals, ask-user responses, and MCP-auth pauses as a typed "extras" escape hatch, readable from any render context including nested sub-agent (readonly) renderers.

### `packages/agent-ui-sdk`

Full details, including 8 worked override examples and known gaps, are in that package's [README](packages/agent-ui-sdk/README.md#architecture) — read it before touching UI here. Structure:

- **Atoms** (`src/atoms/**`) — pure, stateless, prop-driven. Never import `@assistant-ui/*` or the runtime package; never call a runtime/data hook. Own all Tailwind styling.
- **Containers** (`src/containers/**`) — stateful glue. Read assistant-ui primitives/hooks and TrueFoundry runtime hooks, derive plain data/callbacks, and resolve every atom via `useSlot("AtomName")` — never import an atom directly. Contain no styling of their own.
- **Slot registry** (`src/theme/SlotsProvider.tsx`) — `AtomSlots` is augmented per-atom via declaration merging; `defaultSlots.ts` supplies this SDK's defaults. Consumers override via `<SlotsProvider overrides={{...}}>`, nestable, falling back to the default per-slot.
- Caveat: not every slot declared in `AtomSlots` is actually resolved via `useSlot` by the shipped atoms — some low-level primitives (`Button`, `Tooltip*`, `Dialog*`, etc.) are imported directly by the atoms that use them. Check the README's "Good to know before you start swapping" section before assuming an override will take effect.
- Tests render containers against a real in-memory assistant-ui runtime via `src/containers/RuntimeHarness.tsx` — no network calls, no real gateway.

### Build tooling notes

- Both packages build with `tsup` to ESM-only `dist/` (gitignored); `truefoundry-gateway-sdk`'s ESM agent module is aliased/inlined at build and test time (see `tsup.config.ts` / `vitest.config.ts` in the runtime package) because that SDK ships a `.mjs` subpath that needs explicit resolution.
- The runtime package's `tsconfig.json` runs strict mode with `noUncheckedIndexedAccess` — respect that when indexing arrays/objects.
- `pnpm build` at the repo root only builds `agent-ui-sdk^...` (i.e. its dependency chain); it does not build the example app itself, which is bundled by `next build`/`next dev`.
