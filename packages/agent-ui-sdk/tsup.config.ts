import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: [
    "react",
    "react-dom",
    "@assistant-ui/react",
    "@assistant-ui/core",
    "truefoundry-agents-assistant-ui-runtime",
    "truefoundry-gateway-sdk",
  ],
});
