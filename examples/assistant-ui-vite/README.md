# assistant-ui-vite

Standalone Vite + React example that consumes `@assistant-ui/react` and `truefoundry-agents-assistant-ui-runtime` to chat with a TrueFoundry named agent.

## Features

- Credentials form (stored in `localStorage`)
- Thread list sidebar with new chat and load-more
- Streaming chat via `AssistantRuntimeProvider` + `useTrueFoundryAgentRuntime`
- Tool approval panel (`useTrueFoundryApprovals`)
- Ask-user response panel (`useTrueFoundryToolResponses`)

## Prerequisites

Build the runtime package once from the repo root:

```bash
pnpm install
pnpm --filter truefoundry-agents-assistant-ui-runtime build
```

## Run

From the repo root:

```bash
pnpm --filter assistant-ui-vite dev
```

Open [http://localhost:5173](http://localhost:5173) and enter:

| Field | Example |
|-------|---------|
| API key | Your TrueFoundry API key |
| Gateway URL | `https://gateway.truefoundry.ai/<tenant>` |
| Agent name | A saved agent name, e.g. `my-agent` |

## Build

```bash
pnpm --filter assistant-ui-vite build
pnpm --filter assistant-ui-vite preview
```

## Architecture

```
CredentialsForm → localStorage → AgentSessionClient
  → useTrueFoundryAgentRuntime (named mode)
  → AssistantRuntimeProvider
  → ThreadList + Thread + InteractionPanels
```

Named-agent mode only. Draft agents, MCP auth, and attachments UI are not included in this example.
