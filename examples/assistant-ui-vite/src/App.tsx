import { useMemo } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  ErrorToasterProvider,
  Thread,
  ThreadListContainer,
  TooltipProvider,
} from "@truefoundry/agent-ui-sdk";
import {
  trueFoundryAttachmentAdapter,
  useTrueFoundryAgentRuntime,
} from "@truefoundry/assistant-ui-runtime";

import { getAgentSessionClient } from "./lib/agentClient";
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
  const client = useMemo(
    () => getAgentSessionClient(credentials),
    [credentials],
  );

  const runtime = useTrueFoundryAgentRuntime({
    client,
    agentName: credentials.agentName,
    adapters: { attachments: trueFoundryAttachmentAdapter },
    onError: console.error,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ErrorToasterProvider>
        <TooltipProvider>
          <div className="flex h-dvh overflow-hidden">
            <aside className="flex h-full min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r border-border">
              <ThreadListContainer />
            </aside>
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <Thread />
            </div>
          </div>
        </TooltipProvider>
      </ErrorToasterProvider>
    </AssistantRuntimeProvider>
  );
}

export function App() {
  const credentials = loadCredentials();

  if (credentials == null) {
    return <MissingConfig />;
  }

  return <AppContent credentials={credentials} />;
}
