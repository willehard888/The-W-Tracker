import { Capacitor } from "@capacitor/core";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";

const PRODUCTION_URL = "https://status-level-up.lovable.app";
const OAUTH_CALLBACK = "/~oauth/callback";
const APP_SCHEME = "app.lovable.wtracker";
const PUBLISHED_CALLBACK_URL = `${PRODUCTION_URL}${OAUTH_CALLBACK}`;

function createCacheBuster() {
  return `${Date.now()}`;
}

function shouldForceNativeHandoff(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  return params.get("native_handoff") === "1";
}

function shouldUsePublishedAuthPage(): boolean {
  if (typeof window === "undefined") return false;

  if (Capacitor.isNativePlatform()) return true;

  return window.location.origin !== PRODUCTION_URL;
}

function getPublishedAuthUrl(): string {
  const url = new URL("/auth", PRODUCTION_URL);
  url.searchParams.set("apple_sign_in", "1");
  url.searchParams.set("native_handoff", "1");
  url.searchParams.set("app_scheme", APP_SCHEME);
  url.searchParams.set("cb", createCacheBuster());
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

async function openPublishedAuthPageInSystemBrowser() {
  const targetUrl = getPublishedAuthUrl();

  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: targetUrl });
  } catch (error) {
    pushIosDebugLog("AppleAuth", "Failed to open system browser, falling back to in-app redirect", {
      message: errorMessage(error),
      targetUrl,
    });
    redirectToPublishedAuthPage();
  }
}

function getAppleRedirectUri(): string {
  const callbackUrl = new URL(OAUTH_CALLBACK, PRODUCTION_URL);

  if (shouldForceNativeHandoff()) {
    callbackUrl.searchParams.set("native_handoff", "1");
    callbackUrl.searchParams.set("app_scheme", APP_SCHEME);
  }

  callbackUrl.searchParams.set("cb", createCacheBuster());

  if (typeof window !== "undefined" && window.location.origin === PRODUCTION_URL) {
    return callbackUrl.toString();
  }

  return callbackUrl.toString();
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
    forceNativeHandoff: shouldForceNativeHandoff(),
    nativeUsesWebCallback: Capacitor.isNativePlatform(),
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
    if (shouldUsePublishedAuthPage()) {
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
        native: Capacitor.isNativePlatform(),
        currentOrigin: window.location.origin,
        targetUrl,
        forceNativeHandoff: true,
      });

      if (Capacitor.isNativePlatform()) {
        await openPublishedAuthPageInSystemBrowser();
      } else {
        redirectToPublishedAuthPage();
      }

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
