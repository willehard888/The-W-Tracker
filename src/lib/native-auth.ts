import { Capacitor } from "@capacitor/core";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";
import { markAppleUsernameSelectionPending } from "@/lib/apple-username";

const PRODUCTION_URL = "https://status-level-up.lovable.app";
const WEB_OAUTH_CALLBACK = "/oauth/callback";
const APPLE_AUTH_LAUNCH = "/apple-auth-launch";
const APP_SCHEME = "app.lovable.wtracker";
const PUBLISHED_LAUNCH_ATTEMPT_KEY = "w_apple_launch_attempt";

function createCacheBuster() {
  return `${Date.now()}`;
}

function createAttemptId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getSearchParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function getCurrentAttemptId() {
  return getSearchParams().get("attempt");
}

function getStoredAttemptId() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(PUBLISHED_LAUNCH_ATTEMPT_KEY);
}

function markAttemptStarted(attemptId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PUBLISHED_LAUNCH_ATTEMPT_KEY, attemptId);
}

function clearStoredAttempt() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PUBLISHED_LAUNCH_ATTEMPT_KEY);
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
  const url = new URL(APPLE_AUTH_LAUNCH, PRODUCTION_URL);
  url.searchParams.set("native_handoff", "1");
  url.searchParams.set("app_scheme", APP_SCHEME);
  url.searchParams.set("attempt", createAttemptId());
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

  pushIosDebugLog("AppleAuth", "Opening published Apple auth page in system browser", {
    native: Capacitor.isNativePlatform(),
    currentOrigin: typeof window !== "undefined" ? window.location.origin : null,
    targetUrl,
    forceNativeHandoff: true,
  });

  try {
    await openUrlOutsideApp(targetUrl);
  } catch (error) {
    pushIosDebugLog("AppleAuth", "Failed to open system browser, falling back to in-app redirect", {
      message: errorMessage(error),
      targetUrl,
    });
    redirectToPublishedAuthPage();
  }
}

function getAppleRedirectUri(): string {
  const callbackUrl = new URL(WEB_OAUTH_CALLBACK, PRODUCTION_URL);
  const attemptId = getCurrentAttemptId();

  if (shouldForceNativeHandoff()) {
    callbackUrl.searchParams.set("native_handoff", "1");
    callbackUrl.searchParams.set("app_scheme", APP_SCHEME);
  }

  if (attemptId) {
    callbackUrl.searchParams.set("attempt", attemptId);
  }

  callbackUrl.searchParams.set("cb", createCacheBuster());

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

async function openUrlOutsideApp(url: string) {
  try {
    const { AppLauncher } = await import("@capacitor/app-launcher");
    const result = await AppLauncher.openUrl({ url });
    pushIosDebugLog("AppleAuth", "Opened OAuth URL with AppLauncher", {
      url,
      completed: result.completed,
    });
    if (result.completed) return;
  } catch (error) {
    pushIosDebugLog("AppleAuth", "AppLauncher open failed, falling back to Browser", {
      url,
      message: errorMessage(error),
    });
  }

  const { Browser } = await import("@capacitor/browser");
  try {
    await Browser.close();
  } catch {
    // Ignore if no browser session is open.
  }
  await Browser.open({ url });
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
    usingPublishedCallback: redirectUri.startsWith(`${PRODUCTION_URL}${WEB_OAUTH_CALLBACK}`),
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

export async function startPublishedAppleSignIn(): Promise<{ error?: Error }> {
  const attemptId = getCurrentAttemptId() ?? createAttemptId();
  const alreadyStarted = getStoredAttemptId() === attemptId;

  if (alreadyStarted) {
    pushIosDebugLog("AppleAuth", "Skipped duplicate published Apple launch", {
      attemptId,
      href: typeof window !== "undefined" ? window.location.href : null,
    });
    return {};
  }

  markAttemptStarted(attemptId);
  pushIosDebugLog("AppleAuth", "Starting published Apple launch", {
    attemptId,
    href: typeof window !== "undefined" ? window.location.href : null,
  });

  return startManagedAppleOAuth();
}

export function clearPublishedAppleAttempt() {
  clearStoredAttempt();
}

export async function nativeAppleSignIn(): Promise<{ error?: Error }> {
  try {
    markAppleUsernameSelectionPending();

    if (Capacitor.isNativePlatform()) {
      await openPublishedAuthPageInSystemBrowser();
      return {};
    }

    // Non-native preview environments: redirect to published auth page
    if (shouldUsePublishedAuthPage()) {
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
