import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// On native iOS/Android: listen for deep link callbacks from OAuth
if (Capacitor.isNativePlatform()) {
  // Dynamic import to avoid issues on web
  import("@capacitor/core").then(({ App: CapApp }) => {
    // Listen for URL opens (deep links from OAuth redirect)
    (CapApp as any)?.addListener?.("appUrlOpen", async (data: { url: string }) => {
      try {
        const url = new URL(data.url);
        if (url.hash) {
          const params = new URLSearchParams(url.hash.substring(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      } catch (e) {
        console.error("Deep link handling error:", e);
      }
    });
  }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
