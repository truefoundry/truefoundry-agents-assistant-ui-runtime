import { defineConfig } from "tsup";

export default defineConfig({
    entry: [
        "src/index.ts",
        "src/server/index.ts",
        "src/plugins/truefoundry-agent-server-adapter/index.ts",
    ],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    external: [
        "react",
        "@assistant-ui/core",
        "truefoundry-gateway-sdk",
    ],
});
