import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const cpTarget = env.VITE_TFY_CP_URL?.replace(/\/+$/, "");

  return {
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: [
        "truefoundry-gateway-sdk",
        "truefoundry-gateway-sdk/agents",
      ],
    },
    server: {
      port: 5173,
      // Browser calls same-origin /api/*; proxy to Control Plane (avoids CORS).
      ...(cpTarget
        ? {
            proxy: {
              "/api/svc": { target: cpTarget, changeOrigin: true },
              "/api/ml": { target: cpTarget, changeOrigin: true },
              "/api/llm": { target: cpTarget, changeOrigin: true },
            },
          }
        : {}),
    },
  };
});
