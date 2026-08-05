import { useEffect, useMemo, useState } from "react";
import {
  TrueFoundryAssistantUI,
  type TrueFoundryServer,
} from "@truefoundry/agent-ui-sdk";

import { getAgentUIServer } from "./lib/agentClient";
import { loadCredentials, type GatewayCredentials } from "./lib/credentials";

function MissingConfig() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-md space-y-3 rounded-xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">
          Missing configuration
        </h1>
        <p className="text-sm text-muted-foreground">
          Copy{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env</code>{" "}
          and set:
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <code className="text-xs">VITE_TFY_API_KEY</code>
          </li>
          <li>
            <code className="text-xs">VITE_TFY_CP_URL</code>
          </li>
          <li>
            <code className="text-xs">VITE_TFY_GATEWAY_URL</code> (optional)
          </li>
          <li>
            <code className="text-xs">VITE_TFY_AGENT_NAME</code> (optional)
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
  const [server, setServer] = useState<TrueFoundryServer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void getAgentUIServer(credentials)
      .then((s) => {
        if (!cancelled) setServer(s);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [credentials]);

  if (error != null) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <p className="max-w-md text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (server == null) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Connecting…</p>
      </div>
    );
  }

  return (
    <div className="h-dvh">
      <TrueFoundryAssistantUI
        server={server}
        {...(credentials.agentName != null
          ? { agentName: credentials.agentName }
          : {})}
        layout="sidebar"
        className="h-full"
        onError={console.error}
      />
    </div>
  );
}

export function App() {
  const credentials = useMemo(() => loadCredentials(), []);

  if (credentials == null) {
    return <MissingConfig />;
  }

  return <AppContent credentials={credentials} />;
}
