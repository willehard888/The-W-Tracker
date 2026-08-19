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
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            ui: ["@radix-ui/react-dialog", "@radix-ui/react-popover", "@radix-ui/react-tabs", "@radix-ui/react-tooltip", "@radix-ui/react-accordion", "@radix-ui/react-select"],
            charts: ["recharts"],
            three: ["three", "@react-three/fiber", "@react-three/drei"],
            query: ["@tanstack/react-query"],
            motion: ["framer-motion"],
            icons: ["lucide-react"],
            supabase: ["@supabase/supabase-js"],
            capacitor: ["@capacitor/core", "@capacitor/app", "@capacitor/status-bar", "@capacitor/haptics"],
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
