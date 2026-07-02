import { createRequire } from "node:module";
import path from "node:path";

import { defineConfig } from "tsup";

const require = createRequire(import.meta.url);

const gatewaySdkRoot = path.dirname(
    require.resolve("truefoundry-gateway-sdk/package.json"),
);
const agentSessionModule = path.join(
    gatewaySdkRoot,
    "dist/esm/agents/AgentSession.mjs",
);

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    external: [
        "react",
        "@assistant-ui/core",
        "truefoundry-gateway-sdk",
        "truefoundry-gateway-sdk/agents",
    ],
    noExternal: [/^truefoundry-gateway-sdk\/dist\/esm\/agents\//],
    esbuildOptions(options) {
        options.alias = {
            ...options.alias,
            "truefoundry-gateway-sdk/dist/esm/agents/AgentSession.mjs":
                agentSessionModule,
        };
    },
});
