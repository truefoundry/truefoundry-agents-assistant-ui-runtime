import { useState, type FormEvent } from "react";

import {
  saveCredentials,
  type GatewayCredentials,
} from "../lib/credentials";

type CredentialsFormProps = {
  onSubmit: (credentials: GatewayCredentials) => void;
};

export function CredentialsForm({ onSubmit }: CredentialsFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [agentName, setAgentName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedKey = apiKey.trim();
    const trimmedUrl = gatewayUrl.trim();
    const trimmedAgent = agentName.trim();

    if (!trimmedKey || !trimmedUrl || !trimmedAgent) {
      setError("All fields are required.");
      return;
    }

    const credentials: GatewayCredentials = {
      apiKey: trimmedKey,
      gatewayUrl: trimmedUrl,
      agentName: trimmedAgent,
    };

    saveCredentials(credentials);
    onSubmit(credentials);
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            TrueFoundry Agent
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Enter your gateway credentials to start chatting. Values are stored
            in localStorage.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            API key
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="tfy_..."
            autoComplete="off"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Gateway URL
          </span>
          <input
            type="url"
            value={gatewayUrl}
            onChange={(event) => setGatewayUrl(event.target.value)}
            placeholder="https://gateway.truefoundry.ai/your-tenant"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Agent name
          </span>
          <input
            type="text"
            value={agentName}
            onChange={(event) => setAgentName(event.target.value)}
            placeholder="my-agent"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-950"
          />
        </label>

        {error != null && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Connect
        </button>
      </form>
    </div>
  );
}
