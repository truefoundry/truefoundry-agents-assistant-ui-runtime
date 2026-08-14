# assistant-ui-vite

Standalone Vite + React example that wires `@truefoundry/assistant-ui-runtime` to
[`@truefoundry/trueforge-ui`](https://www.npmjs.com/package/@truefoundry/trueforge-ui)
(`0.1.0-rc.1`) for the chat UI.

## Features

- Credentials from `.env` (Vite `import.meta.env`)
- Built-in `TrueforgeUI` TrueFoundry server (`type: "truefoundry"` → CP + gateway pack)
- Optional `agentName` → `agentConfig={{ mode: "SingleAgent", name }}`; omit for Agents Library / draft
- Vite dev proxy for Control Plane paths (avoids browser CORS)
- Built-in history pagination via the SDK's `HistoryLoaderContainer`

## Prerequisites

Build the runtime package once from the repo root:

```bash
pnpm install
pnpm --filter "@truefoundry/assistant-ui-runtime" build
```

## Configuration

Copy `.env.example` to `.env` in this directory and fill in your values:

| Variable | Required | Example |
|----------|----------|---------|
| `VITE_TFY_API_KEY` | ✅ | Your TrueFoundry API key (same bearer for CP + gateway) |
| `VITE_TFY_CP_URL` | ✅ | Control Plane base, e.g. `https://internal.truefoundry.cloud` |
| `VITE_TFY_GATEWAY_URL` | — | Optional gateway override, e.g. `https://gateway.truefoundry.ai/<tenant>` |
| `VITE_TFY_AGENT_NAME` | — | Optional saved agent name; omit for Agents Library / draft |

When `VITE_TFY_GATEWAY_URL` is omitted, the factory calls `GET {cp}/api/svc/v1/session` and uses `{cp}{env.LLM_GATEWAY_URL}/{tenantName}` (typically `{cp}/api/llm/truefoundry`).

### CORS / Vite proxy

In **dev**, the client uses a same-origin `controlPlaneURL` (`""`). Vite proxies:

- `/api/svc` → `VITE_TFY_CP_URL`
- `/api/ml` → `VITE_TFY_CP_URL`
- `/api/llm` → `VITE_TFY_CP_URL`

So browser CP calls do not need Control Plane CORS for localhost.

For **production** `vite build` / `preview`, the client uses the full `VITE_TFY_CP_URL`. That host must allow your origin, or you must front CP with your own proxy. Prefer setting `VITE_TFY_GATEWAY_URL` when you only need named chat.

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
.env → import.meta.env
  → TrueforgeUI server={{ type: "truefoundry", apiKey, controlPlaneURL, gatewayPlaneURL? }}
  → (internally) createTrueFoundryAgentUIServer → sidebar layout
```

Design tokens live in `src/index.css` as CSS variables. The SDK stylesheet is
optional for client-only apps (`ThemeProvider` injects it); this example still
imports `@truefoundry/trueforge-ui/styles.css` for an explicit load order.
