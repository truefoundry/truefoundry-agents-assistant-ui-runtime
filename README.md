# truefoundry-agents-assistant-ui-runtime

TrueFoundry Gateway agent runtime adapter for [assistant-ui](https://www.assistant-ui.com/).

Connect `assistant-ui` chat components to TrueFoundry agent sessions via `useTrueFoundryAgentRuntime`. The adapter handles streaming turns, multi-agent nesting, tool approvals, ask-user flows, MCP OAuth, resumable streams, and file attachment forwarding.

## Repository layout

```
packages/
  truefoundry-agents-assistant-ui-runtime/   # Published npm package
examples/
  assistant-ui-react/                        # Next.js demo app
```

| Path | README |
|------|--------|
| `packages/truefoundry-agents-assistant-ui-runtime` | [Package docs](packages/truefoundry-agents-assistant-ui-runtime/README.md) — installation, API reference, hooks, architecture |
| `examples/assistant-ui-react` | [Example docs](examples/assistant-ui-react/README.md) — running the demo locally |

![Demo screenshot](examples/assistant-ui-react/assets/image.png)

## Quickstart (demo app)

```bash
# 1. Install dependencies and build the package
pnpm install
pnpm build

# 2. Start the Next.js dev server
pnpm dev
# → http://localhost:3000
```

On first load, paste your `.env` content into the credentials form:

```
TFY_API_KEY=your-api-key-here
TFY_GATEWAY_URL=https://gateway.truefoundry.ai/<your-tenant>
TFY_AGENT_NAME=your-agent-name
```

Copy `.env.example` as a reference.

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
