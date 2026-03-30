import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // setup.ts: MongoDB connection (guards itself with typeof check for jsdom)
    // setup-jsdom.ts: mocks sonner + next/navigation for hooks/UI tests
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Run test files sequentially to prevent MongoDB race conditions
    // (duplicate key errors) when multiple files share the same DB.
    fileParallelism: false,
    environmentMatchGlobs: [
      // API + service tests run in node (use default setup.ts with MongoDB)
      ["tests/api/**", "node"],
      ["tests/services/**", "node"],
      // Hooks + UI tests run in jsdom with a lightweight setup (no MongoDB)
      ["tests/hooks/**", "jsdom"],
      ["tests/ui/**", "jsdom"],
    ],
    env: {
      MONGO_URI: "mongodb://localhost:27017/ai_team_management_test_db",
      JWT_SECRET: "test-secret-for-vitest",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
