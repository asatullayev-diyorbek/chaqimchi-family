import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // jsdom for the hook tests; the pure-logic ones don't care either way.
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
