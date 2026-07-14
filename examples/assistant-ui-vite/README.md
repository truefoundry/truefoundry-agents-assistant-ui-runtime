# assistant-ui-vite

Standalone Vite + React example that wires `@truefoundry/assistant-ui-runtime` to
[`@truefoundry/agent-ui-sdk`](https://www.npmjs.com/package/@truefoundry/agent-ui-sdk)
for the chat UI.

## Features

- Gateway credentials from `.env` (Vite `import.meta.env`)
- Session sidebar via `ThreadListContainer`
- Full thread UI via `Thread` (composer, streaming, tool calls, approvals, ask-user, MCP auth)
- Attachments enabled through `trueFoundryAttachmentAdapter`

## Prerequisites

Build the runtime package once from the repo root:

```bash
pnpm install
pnpm --filter "@truefoundry/assistant-ui-runtime" build
```

## Configuration

Copy `.env.example` to `.env` in this directory and fill in your values:

| Variable | Example |
|----------|---------|
| `VITE_TFY_API_KEY` | Your TrueFoundry API key |
| `VITE_TFY_GATEWAY_URL` | `https://gateway.truefoundry.ai/<tenant>` |
| `VITE_TFY_AGENT_NAME` | A saved agent name, e.g. `my-agent` |

`.env` is gitignored. Restart the dev server after changing env values.

## Run

From the repo root:

```bash
pnpm --filter assistant-ui-vite dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
pnpm --filter assistant-ui-vite build
pnpm --filter assistant-ui-vite preview
```

## Architecture

```
.env → import.meta.env → AgentSessionClient
  → useTrueFoundryAgentRuntime({ agentName })
  → AssistantRuntimeProvider
  → ErrorToasterProvider / TooltipProvider
  → ThreadListContainer + Thread (@truefoundry/agent-ui-sdk)
```

Design tokens live in `src/index.css` as CSS variables; the SDK stylesheet is
imported with `@import "@truefoundry/agent-ui-sdk/openui.css"` so Tailwind scans
the SDK components.
