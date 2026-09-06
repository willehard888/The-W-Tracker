import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // Coverage is a ratchet over the PURE LOGIC layer only — lib + data.
      // UI/components stay guarded by tsc, the type-debt ratchet and build.
      // Thresholds are set to the achieved floor; raise them, never lower.
      include: ["src/lib/**/*.ts", "src/data/**/*.ts"],
      exclude: [
        // Native/DOM/side-effect modules — not meaningfully unit-testable:
        "src/lib/haptics.ts",
        "src/lib/platform.ts",
        "src/lib/native-bootstrap.ts",
        "src/lib/native-auth.ts",
        "src/lib/oauth-session.ts",
        "src/lib/route-preload.ts",
        "src/lib/streak-notifications.ts",
        "src/lib/rest-notification.ts",
        "src/lib/health/**",
        "src/lib/downscale-image.ts",
        "src/lib/observability.ts",
        "src/lib/sentry-lite.ts",
        "src/lib/analytics.ts",
        "src/lib/badge-awards.ts",
        "src/lib/tribe-streak.ts",
        "src/lib/exercise-library.ts",
        "src/lib/recipe-images.ts",
        "src/lib/ios-debug.ts",
        "src/lib/apple-username.ts",
        "src/lib/xp-constants.ts",
      ],
      thresholds: {
        // RATCHET FLOOR — current achieved: lines 95.8 / branches 90.8 /
        // funcs 92.8. Raise when coverage grows; never lower. CI enforces
        // via `vitest run --coverage`.
        lines: 94,
        statements: 94,
        branches: 89,
        functions: 91,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
