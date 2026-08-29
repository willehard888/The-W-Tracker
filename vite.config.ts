import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    // Strip console.* and debugger from production bundles only.
    // esbuild is the top-level option; build.minify stays at default ("esbuild").
    ...(mode === "production" && {
      esbuild: { drop: ["console", "debugger"] as ("console" | "debugger")[] },
    }),
    build: {
      target: "es2020",
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          // FUNCTION form on purpose. The object form co-located shared
          // transitive deps (react-is, lodash pieces) INSIDE the charts
          // chunk, so every page chunk statically imported the whole 375KB
          // recharts bundle — Home paid the chart tax on first load. The
          // function assigns only the named packages; shared deps fall into
          // rollup's own common chunks.
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            // Shared glue used by both app code and chart internals — MUST
            // live in vendor. When rollup auto-placed clsx inside charts,
            // every cn() call site statically imported the 375KB recharts
            // chunk and Home paid for charts it never renders.
            if (/node_modules\/(clsx|tailwind-merge|react-is|prop-types)\//.test(id)) return "vendor";
            // recharts + its private deps (lodash et al are recharts-only
            // here per npm ls) stay quarantined together.
            if (/node_modules\/(recharts|victory-vendor|d3-[a-z-]+|react-smooth|recharts-scale|eventemitter3|lodash)[/@-]/.test(id) || id.includes("/d3-")) return "charts";
            if (id.includes("react-router")) return "vendor";
            if (id.includes("react-dom") || /node_modules\/react\//.test(id) || id.includes("scheduler")) return "vendor";
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("framer-motion")) return "motion";
            if (id.includes("lucide")) return "icons";
            if (id.includes("@tanstack")) return "query";
            if (id.includes("@radix-ui")) return "ui";
            if (id.includes("@capacitor")) return "capacitor";
            return undefined;
          },
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
