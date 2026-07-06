import { clearCredentials, type GatewayCredentials } from "../lib/credentials";
import { resetAgentSessionClient } from "../lib/agentClient";
import { Thread } from "./Thread";
import { ThreadList } from "./ThreadList";

type AppShellProps = {
  credentials: GatewayCredentials;
  onResetCredentials: () => void;
};

export function AppShell({ credentials, onResetCredentials }: AppShellProps) {
  const handleReset = () => {
    resetAgentSessionClient();
    clearCredentials();
    onResetCredentials();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            TrueFoundry Agent
          </h1>
          <p className="text-xs text-slate-500">{credentials.agentName}</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Reset credentials
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <ThreadList />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950">
          <Thread />
        </main>
      </div>
    </div>
  );
}
