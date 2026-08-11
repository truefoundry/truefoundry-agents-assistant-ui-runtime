# Quickstart

From-example and manual setup paths to a working agent chat, wired through assistant-ui.

Two paths to a running chat against an `AgentChatServer` (the Vite demo uses the TrueFoundry gateway plugin). The example is fastest; the manual path is what you adapt when integrating into an existing project.

The runtime is a headless adapter: it maps server sessions, turns, and streaming events onto assistant-ui's external-store runtime. You bring the UI (`Thread`, `Composer`, `ThreadList`) from `@assistant-ui/react`, and a pre-built `AgentChatServer` (e.g. `createTrueFoundryAgentUIServer`).

## From the example

The fastest way to see it running is the Vite demo in this repo:

```bash
pnpm install
pnpm --filter "@truefoundry/assistant-ui-runtime" build
pnpm --filter assistant-ui-vite dev
```

Open [http://localhost:5173](http://localhost:5173). Copy `examples/assistant-ui-vite/.env.example` to `.env` and set:

| Field | Example |
|-------|---------|
| `VITE_TFY_API_KEY` | Your TrueFoundry PAT (same bearer for CP + gateway) |
| `VITE_TFY_CP_URL` | Control Plane base URL |
| `VITE_TFY_GATEWAY_URL` | Optional gateway override |
| `VITE_TFY_AGENT_NAME` | Optional — omit for Agents Library / draft |

```bash
# examples/assistant-ui-vite/.env
VITE_TFY_API_KEY=your_truefoundry_pat
VITE_TFY_CP_URL=https://your-control-plane
# VITE_TFY_GATEWAY_URL=https://gateway.truefoundry.ai/<tenant>
# VITE_TFY_AGENT_NAME=my-agent
```

In dev, Vite proxies `/api/svc`, `/api/ml`, and `/api/llm` to `VITE_TFY_CP_URL` so browser CP calls avoid CORS.

Adapt what you see in `examples/assistant-ui-vite` when integrating into your own project, then skip ahead to [Next steps](#next-steps) to start adding features.

## Manual setup in an existing project

Works in any React app (Vite, Next.js, Remix, etc.).

1. ### Install dependencies

   ```bash
   npm install @assistant-ui/react @truefoundry/assistant-ui-runtime truefoundry-gateway-sdk
   ```

2. ### Create the `AgentChatServer`

   Construct the server in your app. The runtime only ever accepts a pre-built `AgentChatServer` — it does **not** read API keys or gateway URLs itself.

   Preferred (chat + Control Plane builder):

   ```ts
   import { createTrueFoundryAgentUIServer } from "@truefoundry/assistant-ui-runtime";

   export async function createServer() {
     return createTrueFoundryAgentUIServer({
       apiKey: import.meta.env.VITE_TFY_API_KEY!,
       cpURL: import.meta.env.VITE_TFY_CP_URL!,
       // gatewayURL: import.meta.env.VITE_TFY_GATEWAY_URL,
     });
   }
   ```

   Chat-only escape hatch: `createTrueFoundryChatServer({ apiKey, baseUrl })`.

3. ### Build the assistant component

   ```tsx
   import { use, useMemo } from "react";
   import { AssistantRuntimeProvider } from "@assistant-ui/react";
   import { useAgentRuntime } from "@truefoundry/assistant-ui-runtime";
   import { Thread } from "@/components/assistant-ui/thread";

   import { createServer } from "./server";

   const serverPromise = createServer();

   export function MyAssistant() {
     const server = use(serverPromise);
     const runtime = useAgentRuntime(
       useMemo(() => ({ server, agentName: "my-agent" }), [server]),
     );

     return (
       <AssistantRuntimeProvider runtime={runtime}>
         <Thread />
       </AssistantRuntimeProvider>
     );
   }
   ```

   > **Next.js App Router:** add `"use client"` at the top of the file, since the runtime relies on React hooks and browser APIs.

4. ### Mount the component

   Render `<MyAssistant />` wherever your framework mounts React:

   ```tsx
   import { MyAssistant } from "./MyAssistant";

   export function App() {
     return (
       <main className="h-dvh">
         <MyAssistant />
       </main>
     );
   }
   ```

5. ### Set environment variables

   Keep secrets in a local env file (e.g. `.env.local`, gitignored):

   ```bash
   # Production (server-side only — never exposed to the browser).
   # Set these on your proxy backend and drop the VITE_* vars below.
   # TFY_API_KEY=your_api_key
   # TFY_GATEWAY_URL=https://gateway.truefoundry.ai/<tenant>

   # Development (hits the gateway directly; key is visible in the browser).
   VITE_TFY_API_KEY=your_api_key
   VITE_TFY_GATEWAY_URL=https://gateway.truefoundry.ai/<tenant>
   ```

6. ### Set up UI components

   Follow the assistant-ui [Thread UI guide](https://www.assistant-ui.com/docs/ui/thread) to wire up the `Thread`, composer, and supporting primitives (this is where `@/components/assistant-ui/thread` comes from).

## Production proxy backend

For development, the client above hits the gateway directly using `VITE_TFY_GATEWAY_URL` and a browser-visible `VITE_TFY_API_KEY`. For production, proxy through your own backend so your API key never reaches the client. Limit the proxy to the endpoints you actually need.

The example below is a Next.js App Router route handler at `app/api/tfy/[...path]/route.ts` — implement the equivalent on any backend.

```ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

async function handleRequest(req: NextRequest, method: string) {
  const path = req.nextUrl.pathname.replace(/^\/?api\/tfy\//, "");
  const search = req.nextUrl.search;

  const options: RequestInit = {
    method,
    headers: {
      // Inject the real key server-side; it never reaches the browser.
      Authorization: `Bearer ${process.env["TFY_API_KEY"] ?? ""}`,
      "content-type": req.headers.get("content-type") ?? "application/json",
    },
    signal: req.signal,
  };
  if (["POST", "PUT", "PATCH"].includes(method)) {
    options.body = await req.text();
  }

  const res = await fetch(
    `${process.env["TFY_GATEWAY_URL"]}/${path}${search}`,
    options,
  );

  // Stream the response straight through (turn streaming is SSE).
  const headers = new Headers(res.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export const GET = (req: NextRequest) => handleRequest(req, "GET");
export const POST = (req: NextRequest) => handleRequest(req, "POST");
export const PUT = (req: NextRequest) => handleRequest(req, "PUT");
export const PATCH = (req: NextRequest) => handleRequest(req, "PATCH");
export const DELETE = (req: NextRequest) => handleRequest(req, "DELETE");
```

With this route in place, drop `VITE_TFY_API_KEY` and `VITE_TFY_GATEWAY_URL` from production env vars; the client helper falls back to the same-origin `/api/tfy` path and sends `auth: false`, so no key is bundled into the client. Set `TFY_API_KEY` and `TFY_GATEWAY_URL` server-side instead.

## Next steps

- **[README](./README.md)** — full option reference, hooks, and the `agentExtras` escape hatch.
- **Thread list** — render `<ThreadList>` from `@assistant-ui/react` alongside `<Thread>`; the runtime supplies a cursor-paginated thread-list adapter automatically (one gateway session ⇄ one thread).
- **Tool approvals & ask-user responses** — `useApprovals` / `useToolResponses` for gating tool calls and answering prompts.
- **Attachments** — opt in by wiring `agentAttachmentAdapter` through the `adapters` option.
