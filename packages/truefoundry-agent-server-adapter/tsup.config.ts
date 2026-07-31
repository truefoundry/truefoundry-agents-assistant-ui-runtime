import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    external: [
        "@truefoundry/assistant-ui-runtime",
        "truefoundry-gateway-sdk",
        "truefoundry-gateway-sdk/agents",
        "truefoundry-gateway-sdk/agents/private",
    ],
});
