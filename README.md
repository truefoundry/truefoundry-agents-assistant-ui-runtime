# @truefoundry/assistant-ui-runtime

Server-centric agent runtime adapter for [assistant-ui](https://www.assistant-ui.com/).

Connect `assistant-ui` chat components to any `AgentChatServer` via `useAgentRuntime`. The adapter handles streaming turns, multi-agent nesting, tool approvals, ask-user flows, MCP OAuth, resumable streams, and file attachment forwarding. Ships with an optional TrueFoundry gateway plugin.

## Repository layout

```
packages/
  truefoundry-agents-assistant-ui-runtime/   # Published as @truefoundry/assistant-ui-runtime
examples/
  assistant-ui-vite/                         # Vite + React demo app
  ink-cli/                                   # Terminal chat demo (Ink)
  assistant-ui-react/                        # Additional React demo
```

| Path | README |
|------|--------|
| `packages/truefoundry-agents-assistant-ui-runtime` | [Package docs](packages/truefoundry-agents-assistant-ui-runtime/README.md) — installation, API reference, hooks, architecture |
| `examples/assistant-ui-vite` | [Example docs](examples/assistant-ui-vite/README.md) — running the demo locally |
| `examples/ink-cli` | [CLI example](examples/ink-cli/README.md) — terminal chat via Ink |

## Quickstart (demo app)

```bash
# 1. Install dependencies and build the package
pnpm install
pnpm build

# 2. Start the Vite dev server
pnpm dev
# → http://localhost:5173
```

Set credentials in `examples/assistant-ui-vite/.env` (see `.env.example`):

```
VITE_TFY_API_KEY      your TrueFoundry API key
VITE_TFY_CP_URL       Control Plane base URL
VITE_TFY_GATEWAY_URL  optional gateway override
VITE_TFY_AGENT_NAME   optional — omit for Agents Library / draft
```

## Using the package in your own app

```bash
npm install @assistant-ui/react @truefoundry/assistant-ui-runtime truefoundry-gateway-sdk
```

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  createTrueFoundryAgentUIServer,
  useAgentRuntime,
} from "@truefoundry/assistant-ui-runtime";

const server = await createTrueFoundryAgentUIServer({
  apiKey: process.env.TFY_API_KEY!,
  cpURL: process.env.TFY_CP_URL!,
});

export function MyAssistant() {
  const runtime = useAgentRuntime({ server, agentName: "my-agent" });
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

[Apache-2.0](LICENSE)

## Contributing / security

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md).
