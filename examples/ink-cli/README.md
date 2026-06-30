# examples/ink-cli
A terminal chat app that demonstrates [`truefoundry-agents-assistant-ui-runtime`](../../packages/truefoundry-agents-assistant-ui-runtime) wired to a live TrueFoundry Gateway agent, rendered with [Ink](https://github.com/vadimdemedes/ink) (`@assistant-ui/react-ink`).
This shows that the same runtime works across frontends — swap the Ink primitives for React DOM or React Native and nothing in the runtime layer changes.
Features shown:
- Streaming assistant responses with markdown rendering
- Reasoning block display
- Tool call status (running, done, error, awaiting approval/input)
- Status bar with message count and run state
## Prerequisites
- Node.js 20+
- pnpm 10+
- A running TrueFoundry Gateway agent and an API key
## Running the example
1. **Install dependencies** from the repo root (this also builds the runtime package):
   ```bash
   # from repo root: truefoundry-agents-assistant-ui-runtime/
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

