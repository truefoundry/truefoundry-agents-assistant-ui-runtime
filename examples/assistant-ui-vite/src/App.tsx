import { useMemo, type ComponentProps } from "react";
import { TrueFoundryAssistantUI } from "@truefoundry/agent-ui-sdk";

import { getAgentChatServer } from "./lib/agentClient";
import { loadCredentials, type GatewayCredentials } from "./lib/credentials";

function MissingConfig() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-md space-y-3 rounded-xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">
          Missing configuration
        </h1>
        <p className="text-sm text-muted-foreground">
          Copy <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env.example</code>{" "}
          to <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env</code> and set:
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <code className="text-xs">VITE_TFY_API_KEY</code>
          </li>
          <li>
            <code className="text-xs">VITE_TFY_GATEWAY_URL</code>
          </li>
          <li>
            <code className="text-xs">VITE_TFY_AGENT_NAME</code>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Restart the dev server after editing env values.
        </p>
      </div>
    </div>
  );
}

function AppContent({ credentials }: { credentials: GatewayCredentials }) {
  const server = useMemo(
    () => getAgentChatServer(credentials),
    [credentials],
  );

  return (
    <div className="h-dvh">
      {/*
        agent-ui-sdk@0.1.0 still types `client`. Pass `server` via cast until
        that package is updated to UseTrueFoundryAgentRuntimeOptions.server.
      */}
      <TrueFoundryAssistantUI
        {...({
          server,
          agentName: credentials.agentName,
          layout: "sidebar",
          className: "h-full",
          onError: console.error,
        } as unknown as ComponentProps<typeof TrueFoundryAssistantUI>)}
      />
    </div>
  );
}

export function App() {
  const credentials = loadCredentials();

  if (credentials == null) {
    return <MissingConfig />;
  }

  return <AppContent credentials={credentials} />;
}
