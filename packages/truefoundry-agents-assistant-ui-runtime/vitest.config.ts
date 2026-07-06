import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const agentSessionModule = path.resolve(
    packageRoot,
    "node_modules/truefoundry-gateway-sdk/dist/esm/agents/AgentSession.mjs",
);

export default defineConfig({
    resolve: {
        alias: {
            "truefoundry-gateway-sdk/dist/esm/agents/AgentSession.mjs":
                agentSessionModule,
        },
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.{ts,tsx}"],
    },
});
