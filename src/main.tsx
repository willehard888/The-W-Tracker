import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { applySessionFromUrl } from "@/lib/oauth-session";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";
import { toast } from "sonner";
import { clearAppleAuthStarted, clearAppleUsernameSelectionPending } from "@/lib/apple-username";
import { supabase } from "@/integrations/supabase/client";
import { initNativeShell } from "@/lib/native-bootstrap";
import { getPerfClass } from "@/lib/perf-class";

// Fire-and-forget — runs before React mount, but doesn't block it.
void initNativeShell();

// Stamp the document body with the detected performance class. A handful of
// global CSS rules in index.css (search: `body[data-perf="low"]`) use this to
// disable decorative-only animation utility classes (animate-breathe-soft,
// status-flame-flicker, animate-scale-pulse, etc.) without touching every
// component individually. The data attribute is set ONCE at startup and the
// browser short-circuits all the keyframe work for ~20+ utility classes
// across the app.
try {
  document.body.dataset.perf = getPerfClass();
} catch {
  // body might not be ready in edge cases; harmless to skip.
}

let oauthHandled = false;
// Timestamp of when oauthHandled was set, so we can expire it after a safe window.
let oauthHandledAt = 0;
const OAUTH_HANDLED_TTL_MS = 30_000;

function summarizeUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    const search = new URLSearchParams(parsed.search);
    const hashParams = new URLSearchParams(hash);
    return {
      scheme: parsed.protocol,
      host: parsed.host,
      pathname: parsed.pathname,
      search: parsed.search ? "present" : "absent",
      hash: hash ? "present" : "absent",
      hasAccessToken: search.has("access_token") || hashParams.has("access_token"),
      hasRefreshToken: search.has("refresh_token") || hashParams.has("refresh_token"),
      hasError: search.has("error") || hashParams.has("error"),
      attempt: search.get("attempt") || hashParams.get("attempt") || null,
      state: search.get("state") || hashParams.get("state") || null,
      length: url.length,
    };
  } catch (e) {
    return { parseError: e instanceof Error ? e.message : String(e), length: url.length };
  }
}

async function handleOAuthUrl(url: string, source: "launch" | "appUrlOpen") {
  if (!url) {
    pushIosDebugLog("DeepLink", "Ignored empty deep link", { source });
    return;
  }

  pushIosDebugLog("DeepLink", "Deep link received", {
    source,
    alreadyHandled: oauthHandled,
    summary: summarizeUrl(url),
  });

  // Allow retry after TTL so a stuck flag doesn't permanently block the user.
  if (oauthHandled && Date.now() - oauthHandledAt < OAUTH_HANDLED_TTL_MS) {
    pushIosDebugLog("DeepLink", "Skipping duplicate OAuth callback", { source });
    return;
  }
  if (oauthHandled) {
    pushIosDebugLog("DeepLink", "oauthHandled TTL expired — retrying", { source });
    oauthHandled = false;
  }

  // Only handle OAuth callback URLs
  if (!url.includes("access_token") && !url.includes("refresh_token")) {
    pushIosDebugLog("DeepLink", "Deep link did not contain OAuth tokens, ignoring", { source });
    return;
  }

  oauthHandled = true;
  oauthHandledAt = Date.now();
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

    const { data } = await supabase.auth.getUser();
    const authUser = data?.user;
    if (!authUser) return;

    const provider = authUser.app_metadata?.provider;
    const providers = Array.isArray(authUser.app_metadata?.providers) ? authUser.app_metadata.providers : [];
    const isAppleUser = provider === "apple" || providers.includes("apple");
    if (!isAppleUser) {
      clearAppleAuthStarted();
      clearAppleUsernameSelectionPending();
    }

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
  pushIosDebugLog("DeepLink", "Registering native deep link listeners", {
    platform: Capacitor.getPlatform(),
  });

  import("@capacitor/app")
    .then(({ App: CapApp }) => {
      CapApp.getLaunchUrl()
        .then((data) => {
          pushIosDebugLog("DeepLink", "getLaunchUrl resolved", {
            hasUrl: Boolean(data?.url),
            summary: data?.url ? summarizeUrl(data.url) : null,
          });
          if (data?.url) {
            void handleOAuthUrl(data.url, "launch");
          }
        })
        .catch((err) => {
          pushIosDebugLog("DeepLink", "getLaunchUrl failed", {
            message: err instanceof Error ? err.message : String(err),
          });
        });

      CapApp.addListener("appUrlOpen", (data: { url: string }) => {
        pushIosDebugLog("DeepLink", "appUrlOpen fired", {
          summary: summarizeUrl(data.url),
        });
        void handleOAuthUrl(data.url, "appUrlOpen");
      });

      CapApp.addListener("resume", async () => {
        pushIosDebugLog("DeepLink", "App resumed", {
          oauthHandled,
          href: window.location.href.slice(0, 160),
        });

        // If we were waiting for an OAuth session but none arrived yet,
        // check if Supabase already has a valid session from the redirect.
        if (!oauthHandled) {
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            pushIosDebugLog("DeepLink", "Session found on resume without deep link", {
              userId: data.session.user?.id,
            });
          }
        }
      });
    })
    .catch((err) => {
      pushIosDebugLog("DeepLink", "@capacitor/app import failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    });
}

createRoot(document.getElementById("root")!).render(<App />);
