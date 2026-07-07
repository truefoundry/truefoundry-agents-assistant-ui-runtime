# examples/ink-cli
A terminal chat app that demonstrates [`@truefoundry/assistant-ui-runtime`](../../packages/truefoundry-agents-assistant-ui-runtime) wired to a live TrueFoundry Gateway agent, rendered with [Ink](https://github.com/vadimdemedes/ink) (`@assistant-ui/react-ink`).

This shows that the same runtime works across frontends — swap the Ink primitives for React DOM or React Native and nothing in the runtime layer changes.

## Features

What this example wires (see [`src/app.tsx`](src/app.tsx), [`src/components/thread.tsx`](src/components/thread.tsx)). Features marked **No** that the runtime itself supports are noted as such — they are simply not wired in this CLI.

| Feature | Supported | Notes |
|---------|-----------|-------|
| Streaming assistant responses | Yes | Markdown rendered via `MarkdownText` (`@assistant-ui/react-ink-markdown`). |
| Reasoning blocks | Yes | Rendered inline, dim italic (`renderReasoning`). |
| Tool call status | Yes | Per-call row: running (`…`), success (`✓`), error (`✗`), awaiting approval, awaiting input. |
| Tool approvals | Yes | `[y] Allow / [n] Deny` prompt (`useTrueFoundryApprovals`). |
| Ask-user prompts | Yes | Free-text answers and `↑`/`↓` option lists (`useTrueFoundryToolResponses`). |
| MCP OAuth | Yes | Prints authorize links, resumes on Enter (`useTrueFoundryMcpAuth`). |
| Status bar | Yes | Agent name, session id, message count, run status (`StatusBarPrimitive`). |
| Loading indicator | Yes | Spinner with elapsed time (`LoadingPrimitive`). |
| Composer | Yes | Multi-line input, submit on Enter (`ComposerPrimitive.Input`). |
| Message windowing & error display | Yes | `windowSize={20}`; inline errors via `ErrorPrimitive`. |
| Resumable streams | Yes | Running turn detected and resumed automatically by the runtime. |
| Session list / thread history | No | Runtime supports it; no `ThreadList` wired — one session per process. |
| File attachments | No | Runtime supports it; `trueFoundryAttachmentAdapter` not wired. |
| Nested sub-agent messages | No | Runtime supports it; tool row shows status only, no nested `part.messages`. |
| Turn cancellation | No | Runtime supports it; `useTrueFoundryCancel` not wired — `Ctrl+C` just exits. |
| Attachment rendering in bubbles | No | Not implemented in the runtime adapter. |
| Speech / dictation / voice / feedback | No | Not implemented in the runtime adapter. |
| Message edit / regenerate / delete | No | Not implemented in the runtime adapter. |
| Client-side tool results & tool-call resume | No | Not implemented in the runtime adapter. |
| Message queue & branch switching | No | Not implemented in the runtime adapter. |
| Thread rename / archive / delete & title generation | No | Not implemented in the runtime adapter. |
| Generative UI parts & source citations | No | Not implemented in the runtime adapter. |
| Message import / external state | No | Not implemented in the runtime adapter. |
| Composer suggestions | No | Not implemented in the runtime adapter. |

For the authoritative list of runtime-level gaps (shared across all frontends), see the package README's [Unsupported assistant-ui features](../../packages/truefoundry-agents-assistant-ui-runtime/README.md#unsupported-assistant-ui-features) table.


## Prerequisites
- Node.js 20+
- pnpm 10+
- A running TrueFoundry Gateway agent and an API key
## Running the example
1. **Install dependencies** (this also builds the runtime package):
   ```bash
   # from repo root: truefoundry-agents-assistant-ui-runtime/ (monorepo root)
   pnpm install
   pnpm build
   ```
2. **Start the CLI:**
   ```bash
   # from repo root
   TFY_API_KEY=your-api-key \
   TFY_GATEWAY_URL=https://gateway.truefoundry.ai/<your-tenant> \
   TFY_AGENT_NAME=your-agent-name \
   pnpm dev:ink
   # or, scoped from this directory:
   TFY_API_KEY=... TFY_GATEWAY_URL=... pnpm dev
   ```
   `TFY_AGENT_NAME` is optional and defaults to `my-agent`.
3. **Chat.** Type a message and press **Enter** to send. Press **Ctrl+C** to exit.
## Key files
| File | Role |
|------|------|
| `src/index.tsx` | Entry point — `render(<App />)` |
| `src/app.tsx` | Reads env vars, creates `AgentSessionClient`, wires `useTrueFoundryAgentRuntime` and `AssistantRuntimeProvider` |
| `src/components/thread.tsx` | Ink UI — messages, composer, loading spinner, tool call display |

