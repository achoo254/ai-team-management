import { defineConfig } from "vitest/config";
import path from "path";

const alias = {
  // Longest prefix first — Vite takes the first matching alias, so a
  // general "@/lib/" listed above "@/lib/config" would shadow it.
  "@/lib/config": path.resolve(__dirname, "packages/api/src/config.ts"),
  // UI + hooks tests resolve to web package
  "@/components/": path.resolve(__dirname, "packages/web/src/components") + "/",
  "@/hooks/": path.resolve(__dirname, "packages/web/src/hooks") + "/",
  "@/lib/": path.resolve(__dirname, "packages/web/src/lib") + "/",
  // API + services tests resolve to api package
  "@/models/": path.resolve(__dirname, "packages/api/src/models") + "/",
  "@/services/": path.resolve(__dirname, "packages/api/src/services") + "/",
  "@/routes/": path.resolve(__dirname, "packages/api/src/routes") + "/",
  "@/app/": path.resolve(__dirname, "packages/api/src/app") + "/",
  // Shared fallback
  "@shared/": path.resolve(__dirname, "packages/shared") + "/",
};

const DOM_TESTS = ["tests/ui/**/*.test.{ts,tsx}", "tests/hooks/**/*.test.{ts,tsx}"];
/** Suites that need a real database. The suffix is the registration — there is
 *  no separate list to keep in sync, so a new DB test cannot silently run
 *  without a connection. */
const DB_TESTS = ["tests/**/*.db.test.{ts,tsx}"];

export default defineConfig({
  resolve: { alias },
  test: {
    globals: false,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          globals: false,
          environment: "node",
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: [...DOM_TESTS, ...DB_TESTS, "**/node_modules/**"],
          setupFiles: ["tests/setup-jsdom.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "dom",
          globals: false,
          environment: "jsdom",
          include: DOM_TESTS,
          setupFiles: ["tests/setup-jsdom.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          globals: false,
          environment: "node",
          include: DB_TESTS,
          // setup.ts boots an ephemeral in-memory mongod; it never reads
          // MONGO_URI because its hooks wipe collections and drop the database.
          setupFiles: ["tests/setup-jsdom.ts", "tests/setup.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
