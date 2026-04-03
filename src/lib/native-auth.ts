import { Capacitor } from "@capacitor/core";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";

const PRODUCTION_URL = "https://status-level-up.lovable.app";
const OAUTH_CALLBACK = "/~oauth/callback";
const APP_SCHEME = "app.lovable.wtracker";
const PUBLISHED_CALLBACK_URL = `${PRODUCTION_URL}${OAUTH_CALLBACK}`;
const NATIVE_CALLBACK_URL = `${APP_SCHEME}://oauth/callback`;

function shouldStartAppleAuthOnPublishedSite(): boolean {
  if (typeof window === "undefined") return false;
  if (Capacitor.isNativePlatform()) return false;

  return window.location.origin !== PRODUCTION_URL;
}

function getPublishedAuthUrl(): string {
  const url = new URL("/auth", PRODUCTION_URL);
  url.searchParams.set("apple_sign_in", "1");
  return url.toString();
}

function redirectToPublishedAuthPage() {
  const targetUrl = getPublishedAuthUrl();

  try {
    if (window.top && window.top !== window) {
      window.top.location.href = targetUrl;
      return;
    }
  } catch {
    // Ignore cross-origin access issues and fall back to current window.
  }

  window.location.href = targetUrl;
}

function getAppleRedirectUri(): string {
  if (Capacitor.isNativePlatform()) {
    return NATIVE_CALLBACK_URL;
  }

  if (typeof window !== "undefined" && window.location.origin === PRODUCTION_URL) {
    return `${window.location.origin}${OAUTH_CALLBACK}`;
  }

  return PUBLISHED_CALLBACK_URL;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function startManagedAppleOAuth(): Promise<{ error?: Error }> {
  const { lovable } = await import("@/integrations/lovable/index");
  const redirectUri = getAppleRedirectUri();

  updateOauthDebug({
    redirectUri,
    sentState: null,
    error: null,
    errorDescription: null,
    sessionApplied: null,
    deepLinkUrl: null,
    handoffToApp: false,
  });

  console.log("[AppleAuth] Starting managed OAuth, redirect →", redirectUri);
  pushIosDebugLog("AppleAuth", "Starting managed Apple OAuth flow", {
    redirectUri,
    appScheme: APP_SCHEME,
    currentOrigin: typeof window !== "undefined" ? window.location.origin : null,
    usingPublishedCallback: redirectUri === PUBLISHED_CALLBACK_URL,
    platform: Capacitor.getPlatform(),
    native: Capacitor.isNativePlatform(),
  });

  const result = await lovable.auth.signInWithOAuth("apple", {
    redirect_uri: redirectUri,
  });

  if (result?.redirected) {
    pushIosDebugLog("AppleAuth", "Managed Apple OAuth redirect started", {
      redirected: true,
      redirectUri,
    });
    return {};
  }

  if (result?.error) {
    console.error("[AppleAuth] Managed OAuth returned error:", result.error);
    const message = errorMessage(result.error);
    updateOauthDebug({ error: message });
    pushIosDebugLog("AppleAuth", "Managed Apple OAuth error", result.error);
    return { error: result.error as Error };
  }

  pushIosDebugLog("AppleAuth", "Managed Apple OAuth finished without redirect", result);
  return {};
}

export async function nativeAppleSignIn(): Promise<{ error?: Error }> {
  try {
    if (shouldStartAppleAuthOnPublishedSite()) {
      const targetUrl = getPublishedAuthUrl();

      updateOauthDebug({
        redirectUri: PUBLISHED_CALLBACK_URL,
        error: null,
        errorDescription: null,
        sessionApplied: null,
        deepLinkUrl: null,
        handoffToApp: false,
      });

      pushIosDebugLog("AppleAuth", "Redirecting Apple Sign In to published auth page", {
        currentOrigin: window.location.origin,
        targetUrl,
      });

      redirectToPublishedAuthPage();
      return {};
    }

    return await startManagedAppleOAuth();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[AppleAuth] Unexpected error:", error);
    updateOauthDebug({ error: error.message });
    pushIosDebugLog("AppleAuth", "Unexpected OAuth exception", { message: error.message });
    return { error };
  }
}
