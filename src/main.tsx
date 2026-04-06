import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { applySessionFromUrl } from "@/lib/oauth-session";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";
import { toast } from "sonner";

let lastHandledUrl: string | null = null;

async function handleOAuthUrl(url: string, source: "launch" | "appUrlOpen") {
  if (!url || url === lastHandledUrl) return;
  lastHandledUrl = url;

  console.log(`[DeepLink] Received ${source} URL:`, url);

  try {
    const parsed = new URL(url, window.location.origin);
    const search = parsed.searchParams;
    const hash = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash);
    const hasAccessToken = search.has("access_token") || hash.has("access_token");
    const hasRefreshToken = search.has("refresh_token") || hash.has("refresh_token");

    updateOauthDebug({
      callbackUrl: url,
      callbackPath: `${parsed.pathname}${parsed.search}${parsed.hash}`,
      callbackAt: new Date().toISOString(),
      deepLinkUrl: url,
      handoffToApp: false,
      returnedState: search.get("state") ?? hash.get("state"),
      error: search.get("error") ?? hash.get("error"),
      errorDescription: search.get("error_description") ?? hash.get("error_description"),
      hasAccessToken,
      hasRefreshToken,
      sessionApplied: null,
    });

    pushIosDebugLog("DeepLink", "Native OAuth callback received", {
      source,
      url,
      hasAccessToken,
      hasRefreshToken,
    });

    const didApplySession = await applySessionFromUrl(url);
    updateOauthDebug({ sessionApplied: didApplySession });

    if (!didApplySession) {
      pushIosDebugLog("DeepLink", "No OAuth tokens found in callback URL", { source, url });
      toast.error("Sign in failed — no session received. Please try again.");
      return;
    }

    pushIosDebugLog("DeepLink", "OAuth session applied successfully", { source });

    import("@capacitor/browser")
      .then(({ Browser }) => Browser.close())
      .catch(() => {
        // Browser plugin may not be available in all environments
      });

    window.location.replace("/");
  } catch (e) {
    console.error("[DeepLink] Error handling deep link:", e);
    const message = e instanceof Error ? e.message : String(e);
    toast.error(`Sign in error: ${message}`);
    updateOauthDebug({ error: message });
    pushIosDebugLog("DeepLink", "Deep link processing failed", { source, message, url });
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
