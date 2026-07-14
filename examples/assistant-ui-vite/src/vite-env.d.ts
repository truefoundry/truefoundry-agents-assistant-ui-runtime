/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TFY_API_KEY: string;
  readonly VITE_TFY_GATEWAY_URL: string;
  readonly VITE_TFY_AGENT_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
