# truefoundry-agents-assistant-ui-runtime

TrueFoundry Gateway agent runtime adapter for [assistant-ui](https://www.assistant-ui.com/).

Connect `assistant-ui` chat components to TrueFoundry agent sessions via `useTrueFoundryAgentRuntime`. The adapter handles streaming turns, multi-agent nesting, tool approvals, ask-user flows, MCP OAuth, resumable streams, and file attachment forwarding.

## Repository layout

```
packages/
  truefoundry-agents-assistant-ui-runtime/   # Published npm package
examples/
  assistant-ui-vite/                         # Vite + React demo app
```

| Path | README |
|------|--------|
| `packages/truefoundry-agents-assistant-ui-runtime` | [Package docs](packages/truefoundry-agents-assistant-ui-runtime/README.md) — installation, API reference, hooks, architecture |
| `examples/assistant-ui-vite` | [Example docs](examples/assistant-ui-vite/README.md) — running the demo locally |

## Quickstart (demo app)

```bash
# 1. Install dependencies and build the package
pnpm install
pnpm build

# 2. Start the Vite dev server
pnpm dev
# → http://localhost:5173
```

On first load, enter your credentials in the form (stored in `localStorage`):

```
API key      your TrueFoundry API key
Gateway URL  https://gateway.truefoundry.ai/<your-tenant>
Agent name   a saved agent name, e.g. my-agent
```

## Using the package in your own app

```bash
npm install @assistant-ui/react truefoundry-agents-assistant-ui-runtime truefoundry-gateway-sdk
```

```tsx
import { AgentSessionClient } from "truefoundry-gateway-sdk/agents";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useTrueFoundryAgentRuntime } from "truefoundry-agents-assistant-ui-runtime";

const client = new AgentSessionClient({
  apiKey: process.env.TFY_API_KEY!,
  environment: process.env.TFY_GATEWAY_URL!,
});

export function MyAssistant() {
  const runtime = useTrueFoundryAgentRuntime({ client, agentName: "my-agent" });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

See the [package README](packages/truefoundry-agents-assistant-ui-runtime/README.md) for the full API reference.

## Development commands

Run from the repo root:

| Command | Description |
|---------|-------------|
| `pnpm build` | Build the runtime package (`tsup → dist/`) |
| `pnpm test` | Run the package test suite (vitest) |
| `pnpm typecheck` | Type-check the package |
| `pnpm dev` | Build the package then start the example dev server |

## License

MIT
