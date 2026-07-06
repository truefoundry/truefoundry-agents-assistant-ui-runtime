import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
