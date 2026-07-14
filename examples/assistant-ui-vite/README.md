# assistant-ui-vite

Standalone Vite + React example that consumes `@assistant-ui/react` and `@truefoundry/assistant-ui-runtime` to chat with a TrueFoundry named agent.

## Features

- Gateway credentials from `.env` (Vite `import.meta.env`)
- Thread list sidebar with new chat and load-more
- Streaming chat via `AssistantRuntimeProvider` + `useTrueFoundryAgentRuntime`
- Tool approval panel (`useTrueFoundryApprovals`)
- Ask-user response panel (`useTrueFoundryToolResponses`)

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
  → useTrueFoundryAgentRuntime (named mode)
  → AssistantRuntimeProvider
  → Chat (thread list + thread + interaction panels)
```

Named-agent mode only. Draft agents, MCP auth, and attachments UI are not included in this example.
