import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { applySessionFromUrl } from "@/lib/oauth-session";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";
import { clearAppleAuthStarted, clearAppleUsernameSelectionPending, isAppleAuthStarted, markAppleUsernameSelectionPending } from "@/lib/apple-username";
import { supabase } from "@/integrations/supabase/client";

const APP_SCHEME = "app.lovable.wtracker";

let registered = false;

/**
 * Convert a custom-scheme deep link (app.lovable.wtracker://oauth/callback?...)
 * into a standard https URL so URL parsers and applySessionFromUrl can handle it.
 */
function normalizeDeepLink(deepLinkUrl: string): string {
  try {
    // Replace the custom scheme with https so URL parser works reliably across hash/search.
    // Example: app.lovable.wtracker://oauth/callback?... → https://callback.local/oauth/callback?...
    const withHttps = deepLinkUrl.replace(/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//, "https://callback.local/");
    return withHttps;
  } catch {
    return deepLinkUrl;
  }
}

function isOAuthDeepLink(url: string): boolean {
  if (!url.startsWith(`${APP_SCHEME}://`)) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("access_token=") ||
    lower.includes("refresh_token=") ||
    lower.includes("error=") ||
    lower.includes("oauth")
  );
}

async function handleAppleDeepLinkSession(deepLinkUrl: string) {
  pushIosDebugLog("DeepLink", "Received Apple OAuth deep link", { deepLinkUrl });

  const normalized = normalizeDeepLink(deepLinkUrl);
  const url = new URL(normalized);

  // Merge hash params into search for parsing
  const search = new URLSearchParams(url.search);
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  hash.forEach((v, k) => search.set(k, v));

  const oauthError = search.get("error");
  const oauthErrorDescription = search.get("error_description");

  updateOauthDebug({
    deepLinkUrl,
    callbackAt: new Date().toISOString(),
    hasAccessToken: search.has("access_token"),
    hasRefreshToken: search.has("refresh_token"),
    error: oauthError,
    errorDescription: oauthErrorDescription,
    handoffToApp: true,
  });

  if (oauthError) {
    pushIosDebugLog("DeepLink", "OAuth provider returned error", {
      error: oauthError,
      errorDescription: oauthErrorDescription,
    });
    clearAppleAuthStarted();
    clearAppleUsernameSelectionPending();
    return;
  }

  const sessionApplied = await applySessionFromUrl(normalized);
  updateOauthDebug({ sessionApplied });
  pushIosDebugLog("DeepLink", "Session apply result from deep link", { sessionApplied });

  if (sessionApplied) {
    // Trigger username-selection flow for new Apple users
    try {
      const { data } = await supabase.auth.getUser();
      const authUser = data?.user;
      if (authUser && isAppleAuthStarted()) {
        const provider = authUser.app_metadata?.provider;
        const providers = Array.isArray(authUser.app_metadata?.providers) ? authUser.app_metadata.providers : [];
        const isAppleUser = provider === "apple" || providers.includes("apple");
        if (isAppleUser) {
          // Let AuthContext.fetchProfile decide whether to mark pending; preempt fallback by marking now.
          markAppleUsernameSelectionPending();
        }
      }
    } catch (err) {
      pushIosDebugLog("DeepLink", "Could not inspect user after session apply", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function registerDeepLinkHandler() {
  if (registered) return;
  if (!Capacitor.isNativePlatform()) return;

  registered = true;

  App.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
    const url = event?.url;
    if (!url) return;

    pushIosDebugLog("DeepLink", "appUrlOpen received", { url });

    if (isOAuthDeepLink(url)) {
      void handleAppleDeepLinkSession(url);
    }
  }).catch((err) => {
    pushIosDebugLog("DeepLink", "Failed to register appUrlOpen listener", {
      message: err instanceof Error ? err.message : String(err),
    });
  });
}
