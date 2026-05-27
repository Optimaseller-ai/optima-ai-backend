import { defineConfig } from "tsup";
import path from "path";

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
  esbuildOptions(options) {
    options.alias = {
      "@": path.resolve("src"),
      "server-only": path.resolve("src/shims/server-only.ts"),
    };
  },
});

