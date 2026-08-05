# Changelog

## 0.1.8

### Breaking

- **`AgentChatServer.prepareAndExecuteTurn` → `createTurn`**  
  Rename the method on every `AgentChatServer` implementation and mock. Signature and return type are unchanged.

- **`ConnectorAuthType` is now `"oauth" | "apiKey" | "none"`**  
  Previously an open `string` with documented display labels (`"None"`, `"OAuth"`, `"API Key"`). Map host/wire values to these camelCase literals.

- **`ConnectorAuth` / `ConnectorAuthPublic` are discriminated unions**  
  - Write: `{ type: "oauth"; authUrl?: string } | { type: "apiKey"; apiKey?: string; headerName?: string } | { type: "none" }`  
  - Public: oauth branch requires `authUrl: string` (no secrets).  
  Branch types (`ConnectorAuthOAuth`, `ConnectorAuthPublicOAuth`, …) are exported so hosts can intersect extras and re-union, e.g. `ConnectorAuthPublicOAuth & { custom: string }`.

- **`ConnectorBase.requiresAuth: boolean`**  
  Required alongside existing `authenticated`. When `requiresAuth` is true, UI should not show Disconnect.

### Notes

- After `authenticateConnector`, OAuth authorize URL is on `connector.auth.authUrl` when `auth.type === "oauth"` (not a separate widened return field).
