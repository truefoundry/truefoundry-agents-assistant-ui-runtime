import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Keep a single assistant-ui / React copy so AuiProvider hooks resolve.
    dedupe: [
      "react",
      "react-dom",
      "@assistant-ui/core",
      "@assistant-ui/react",
      "@assistant-ui/store",
    ],
  },
  optimizeDeps: {
    include: [
      "truefoundry-gateway-sdk",
      "truefoundry-gateway-sdk/agents",
    ],
  },
  server: {
    port: 5173,
  },
});
