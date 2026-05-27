import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  dts: false,
  splitting: false,
  treeshake: true,
  outExtension: () => ({ js: ".cjs" }),
});

