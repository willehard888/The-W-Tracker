import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {

  return {
    server: {
      host: "::",
      port: Number(process.env.PORT) || 8080,
      hmr: {
        overlay: false,
      },
    },
    // Strip console.* and debugger from production bundles only.
    // esbuild is the top-level option; build.minify stays at default ("esbuild").
    ...(mode === "production" && {
      esbuild: { drop: ["console", "debugger"] as ("console" | "debugger")[] },
    }),
    // Sentry is error-only: these compile-time flags let rollup drop the
    // debug/tracing/replay code paths from @sentry/* (names verified against
    // node_modules/@sentry/*).
    define: {
      __SENTRY_DEBUG__: false,
      __SENTRY_TRACING__: false,
      __RRWEB_EXCLUDE_IFRAME__: true,
      __RRWEB_EXCLUDE_SHADOW_DOM__: true,
      __SENTRY_EXCLUDE_REPLAY_WORKER__: true,
    },
    build: {
      target: "es2020",
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          // FUNCTION form on purpose. The object form co-located shared
          // transitive deps inside whichever chunk claimed them first, so a
          // page chunk could statically import a big lazy one for a helper.
          // The function assigns only the named packages; everything else
          // falls into rollup's own common chunks.
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            // Shared glue every cn() call site touches — pinned to vendor so
            // rollup can't bury it in a lazy chunk and make Home import that
            // chunk for a class name.
            if (/node_modules\/(clsx|tailwind-merge|react-is|prop-types)\//.test(id)) return "vendor";
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
