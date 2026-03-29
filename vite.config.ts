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
