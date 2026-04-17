import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { applySessionFromUrl } from "@/lib/oauth-session";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";
import { toast } from "sonner";
import { clearAppleAuthStarted, clearAppleUsernameSelectionPending } from "@/lib/apple-username";

let oauthHandled = false;

async function handleOAuthUrl(url: string, source: "launch" | "appUrlOpen") {
  if (!url || oauthHandled) return;

  // Only handle OAuth callback URLs
  if (!url.includes("access_token") && !url.includes("refresh_token")) return;

  oauthHandled = true;
  console.log(`[DeepLink] Processing ${source} OAuth callback`);

  try {
    const parsed = new URL(url, window.location.origin);
    const search = parsed.searchParams;
    const hash = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash);

    updateOauthDebug({
      callbackUrl: url,
      callbackPath: `${parsed.pathname}${parsed.search}${parsed.hash}`,
      callbackAt: new Date().toISOString(),
      deepLinkUrl: url,
      handoffToApp: false,
      returnedState: search.get("state") ?? hash.get("state"),
      hasAccessToken: search.has("access_token") || hash.has("access_token"),
      hasRefreshToken: search.has("refresh_token") || hash.has("refresh_token"),
      sessionApplied: null,
    });

    pushIosDebugLog("DeepLink", "Native OAuth callback received", { source, url: url.slice(0, 120) + "..." });

    const didApplySession = await applySessionFromUrl(url);
    updateOauthDebug({ sessionApplied: didApplySession });

    if (!didApplySession) {
      pushIosDebugLog("DeepLink", "No session from callback", { source });
      clearAppleAuthStarted();
      clearAppleUsernameSelectionPending();
      toast.error("Connection error. Try again.");
      oauthHandled = false;
      return;
    }

    pushIosDebugLog("DeepLink", "OAuth session applied successfully", { source });

    // Don't reload — AuthContext will pick up the session change automatically
  } catch (e) {
    console.error("[DeepLink] Error:", e);
    clearAppleAuthStarted();
    clearAppleUsernameSelectionPending();
    const message = "Connection error. Try again.";
    toast.error(message);
    updateOauthDebug({ error: message });
    oauthHandled = false;
  }
}

// On native iOS/Android: listen for deep link callbacks from OAuth
if (Capacitor.isNativePlatform()) {
  import("@capacitor/app")
    .then(({ App: CapApp }) => {
      CapApp.getLaunchUrl().then((data) => {
        if (data?.url) {
          void handleOAuthUrl(data.url, "launch");
        }
      }).catch(() => {
        // Ignore launch URL lookup failures
      });

      CapApp.addListener("appUrlOpen", (data: { url: string }) => {
        void handleOAuthUrl(data.url, "appUrlOpen");
      });
    })
    .catch(() => {
      // @capacitor/app not available, skip
    });
}

createRoot(document.getElementById("root")!).render(<App />);
