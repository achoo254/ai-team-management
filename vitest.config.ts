import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // UI + hooks tests resolve to web package
      "@/components/": path.resolve(__dirname, "packages/web/src/components") + "/",
      "@/hooks/": path.resolve(__dirname, "packages/web/src/hooks") + "/",
      "@/lib/": path.resolve(__dirname, "packages/web/src/lib") + "/",
      // API + services tests resolve to api package
      "@/models/": path.resolve(__dirname, "packages/api/src/models") + "/",
      "@/services/": path.resolve(__dirname, "packages/api/src/services") + "/",
      "@/routes/": path.resolve(__dirname, "packages/api/src/routes") + "/",
      "@/app/": path.resolve(__dirname, "packages/api/src/app") + "/",
      "@/lib/config": path.resolve(__dirname, "packages/api/src/config.ts"),
      // Shared fallback
      "@shared/": path.resolve(__dirname, "packages/shared") + "/",
    },
  },
  test: {
    globals: false,
    include: [
      "tests/hooks/**/*.test.{ts,tsx}",
      "tests/lib/**/*.test.{ts,tsx}",
      "tests/api/usage-window-detector.test.ts",
      "tests/api/bld-metrics.test.ts",
      "tests/api/bld-pdf-service.test.ts",
    ],
    exclude: ["tests/ui/**", "tests/services/**"],
    // UI tests opt-in via // @vitest-environment jsdom comment
    environment: "node",
  },
});
