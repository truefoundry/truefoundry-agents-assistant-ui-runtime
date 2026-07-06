import { useState } from "react";

import { AssistantProvider } from "./components/AssistantProvider";
import { AppShell } from "./components/AppShell";
import { CredentialsForm } from "./components/CredentialsForm";
import {
  loadCredentials,
  type GatewayCredentials,
} from "./lib/credentials";

export function App() {
  const [credentials, setCredentials] = useState<GatewayCredentials | null>(
    () => loadCredentials(),
  );

  if (credentials == null) {
    return <CredentialsForm onSubmit={setCredentials} />;
  }

  return (
    <AssistantProvider credentials={credentials}>
      <AppShell
        credentials={credentials}
        onResetCredentials={() => setCredentials(null)}
      />
    </AssistantProvider>
  );
}
