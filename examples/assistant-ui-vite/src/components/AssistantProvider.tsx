import { useMemo, useState, type ReactNode } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  trueFoundryAttachmentAdapter,
  useTrueFoundryAgentRuntime,
} from "@truefoundry/assistant-ui-runtime";

import { getAgentSessionClient } from "../lib/agentClient";
import type { GatewayCredentials } from "../lib/credentials";

type AssistantProviderProps = {
  credentials: GatewayCredentials;
  children: ReactNode;
};

export function AssistantProvider({
  credentials,
  children,
}: AssistantProviderProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const client = useMemo(
    () => getAgentSessionClient(credentials),
    [credentials],
  );

  const runtime = useTrueFoundryAgentRuntime({
    client,
    agent: {
      mode: "named",
      agentName: credentials.agentName,
    },
    adapters: {
      attachments: trueFoundryAttachmentAdapter,
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred.";
      setErrorMessage(message);
      console.error(error);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {errorMessage != null && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="ml-3 underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
    </AssistantRuntimeProvider>
  );
}
