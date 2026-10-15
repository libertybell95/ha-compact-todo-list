import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

export default defineConfig(({ mode }) => ({
  define: {
    __CARD_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: "es2021",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: mode === "development",
    minify: mode !== "development",
    // Library mode keeps whitespace in ES output by default; HACS users get one file, so minify fully.
    rolldownOptions: {
      output: { minify: mode !== "development" },
    },
    lib: {
      entry: "src/compact-todo-card.ts",
      formats: ["es"],
      fileName: () => "ha-compact-todo-card.js",
    },
  },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
  },
}));
