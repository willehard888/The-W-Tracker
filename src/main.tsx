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
        try {
          const didApplySession = await applySessionFromUrl(data.url);
          if (!didApplySession) {
            console.warn("OAuth callback opened without session tokens:", data.url);
          }
        } catch (e) {
          console.error("Deep link handling error:", e);
        }
      });
    })
    .catch(() => {
      // @capacitor/app not available, skip
    });
}

createRoot(document.getElementById("root")!).render(<App />);
