import { useMemo, useState, type ReactNode } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  trueFoundryAttachmentAdapter,
  useTrueFoundryAgentRuntime,
  useTrueFoundryReload,
} from "@truefoundry/assistant-ui-runtime";

import { getAgentSessionClient } from "../lib/agentClient";
import type { GatewayCredentials } from "../lib/credentials";

type AssistantProviderProps = {
  credentials: GatewayCredentials;
  children: ReactNode;
};

type ErrorBannerProps = {
  message: string;
  onDismiss: () => void;
};

function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  const reload = useTrueFoundryReload();

  const handleRetry = () => {
    onDismiss();
    reload();
  };

  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {message}
      <button
        type="button"
        onClick={handleRetry}
        className="ml-3 underline"
      >
        Retry
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-3 underline"
      >
        Dismiss
      </button>
    </div>
  );
}

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
    onThreadIdChange: () => {
      setErrorMessage(null);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {errorMessage != null && (
        <ErrorBanner
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}
      {children}
    </AssistantRuntimeProvider>
  );
}
