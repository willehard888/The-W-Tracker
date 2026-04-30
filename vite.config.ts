import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const useCloudAuthMock = process.env.MOCK_CLOUD_AUTH === "true";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
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
            capacitor: ["@capacitor/core", "@capacitor/app", "@capacitor/keyboard", "@capacitor/status-bar", "@capacitor/haptics"],
          },
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // Optional local-only fallback mock (disabled by default)
        ...(useCloudAuthMock
          ? { "@lovable.dev/cloud-auth-js": path.resolve(__dirname, "./src/mocks/cloud-auth.ts") }
          : {}),
      },
    },
  };
});
