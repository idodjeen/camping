import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Tests run against PGlite, never the shared `dev` database (docs/adr/0001).
// Each test file gets its own fresh database from src/test/setup.ts.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    // Applying every migration takes a moment on a cold PGlite.
    hookTimeout: 30_000,
    // next-auth imports "next/server" without an extension, which Node's ESM
    // loader can't resolve; letting Vite bundle it resolves it like Next does.
    server: { deps: { inline: ["next-auth"] } },
  },
});
