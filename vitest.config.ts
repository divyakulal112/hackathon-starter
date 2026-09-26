import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vitest — unit tests for the lib/data DataSource seam.
 * Node environment: every module under test is DOM-free except
 * localStorageSource, whose tests inject a localStorage/window polyfill.
 */
const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx", "context/**/*.test.tsx", "scripts/**/*.test.ts"],
    globals: false,
  },
});
