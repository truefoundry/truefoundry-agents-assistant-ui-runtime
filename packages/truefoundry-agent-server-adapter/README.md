# `@truefoundry/agent-server-adapter`

Adapts `truefoundry-gateway-sdk`'s `AgentSessionClient` / `PrivateAgentSessionClient`
into the flat [`AgentChatServer`](../truefoundry-agents-assistant-ui-runtime/src/server/types.ts)
contract used by `@truefoundry/assistant-ui-runtime`.

```ts
import { createTrueFoundryChatServer } from "@truefoundry/agent-server-adapter";
import { useTrueFoundryAgentRuntime } from "@truefoundry/assistant-ui-runtime";

const server = createTrueFoundryChatServer({
  apiKey,
  baseUrl: gatewayUrl,
});

const runtime = useTrueFoundryAgentRuntime({
  server,
  agentName: "my-agent",
});
```

This is the **only** package in the monorepo that depends on `truefoundry-gateway-sdk`.
