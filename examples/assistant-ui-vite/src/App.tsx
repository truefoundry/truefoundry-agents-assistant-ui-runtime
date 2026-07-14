import { useMemo } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useTrueFoundryAgentRuntime } from "@truefoundry/assistant-ui-runtime";

import { Chat } from "./components/Chat";
import { getAgentSessionClient } from "./lib/agentClient";
import { loadCredentials, type GatewayCredentials } from "./lib/credentials";

function MissingConfig() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="panel max-w-md space-y-3 p-6">
        <h1 className="text-lg font-semibold text-slate-900">
          Missing configuration
        </h1>
        <p className="text-sm text-slate-600">
          Copy <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.example</code>{" "}
          to <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env</code> and set:
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
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
        <p className="text-xs text-slate-500">
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
    onError: console.error,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div>
            <h1 className="text-sm font-semibold text-slate-900">
              TrueFoundry Agent
            </h1>
            <p className="text-xs text-slate-500">{credentials.agentName}</p>
          </div>
        </header>
        <Chat />
      </div>
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
