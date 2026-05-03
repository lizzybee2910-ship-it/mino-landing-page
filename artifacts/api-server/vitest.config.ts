import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    conditions: ["workspace"],
    alias: {
      "@workspace/db": path.resolve(__dirname, "../../lib/db/src/index.ts"),
      "@workspace/api-zod": path.resolve(
        __dirname,
        "../../lib/api-zod/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
    pool: "forks",
    testTimeout: 10000,
  },
});
