import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli/index.ts", "src/agent/agent.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  splitting: true,
  sourcemap: true,
  dts: true,
});
