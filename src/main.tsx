import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { applySessionFromUrl } from "@/lib/oauth-session";

// On native iOS/Android: listen for deep link callbacks from OAuth
if (Capacitor.isNativePlatform()) {
  import("@capacitor/app")
    .then(({ App: CapApp }) => {
      CapApp.addListener("appUrlOpen", async (data: { url: string }) => {
        console.log("[DeepLink] Received URL:", data.url);
        try {
          const didApplySession = await applySessionFromUrl(data.url);
          if (didApplySession) {
            console.log("[DeepLink] Session applied successfully, navigating to home");
            // Force navigation to home after successful OAuth
            window.location.hash = "";
            window.location.pathname = "/";
          } else {
            console.warn("[DeepLink] No session tokens in URL:", data.url);
          }
        } catch (e) {
          console.error("[DeepLink] Error handling deep link:", e);
        }
      });
    })
    .catch(() => {
      // @capacitor/app not available, skip
    });
}

createRoot(document.getElementById("root")!).render(<App />);
