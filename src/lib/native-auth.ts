import { Capacitor } from "@capacitor/core";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";
import { markAppleUsernameSelectionPending } from "@/lib/apple-username";

const PRODUCTION_URL = "https://status-level-up.lovable.app";
const OAUTH_BROKER = "/~oauth/initiate";
const OAUTH_CALLBACK = "/~oauth/callback";
const APPLE_AUTH_LAUNCH = "/apple-auth-launch";
const APP_SCHEME = "app.lovable.wtracker";
const PUBLISHED_CALLBACK_URL = `${PRODUCTION_URL}${OAUTH_CALLBACK}`;
const PUBLISHED_LAUNCH_ATTEMPT_KEY = "w_apple_launch_attempt";
const PUBLISHED_OAUTH_STATE_KEY = "w_apple_oauth_state";

function createCacheBuster() {
  return `${Date.now()}`;
}

function createAttemptId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createOAuthState() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
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

function getRequestedState() {
  return getSearchParams().get("state");
}

function markExpectedState(state: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PUBLISHED_OAUTH_STATE_KEY, state);
}

export function getStoredAppleOAuthState() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(PUBLISHED_OAUTH_STATE_KEY);
}

function clearStoredOAuthState() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PUBLISHED_OAUTH_STATE_KEY);
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
  const state = createOAuthState();

  markExpectedState(state);
  url.searchParams.set("native_handoff", "1");
  url.searchParams.set("app_scheme", APP_SCHEME);
  url.searchParams.set("attempt", createAttemptId());
  url.searchParams.set("state", state);
  url.searchParams.set("cb", createCacheBuster());
  return url.toString();
}

function getNativeAppCallbackUrl() {
  return `${APP_SCHEME}://oauth/callback`;
}

function getNativeBrokerUrl(state: string, attemptId: string) {
  const url = new URL(OAUTH_BROKER, PRODUCTION_URL);
  url.searchParams.set("provider", "apple");
  url.searchParams.set("redirect_uri", getNativeAppCallbackUrl());
  url.searchParams.set("state", state);
  url.searchParams.set("attempt", attemptId);
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

async function openNativeBrokerInSystemBrowser(attemptId: string, state: string): Promise<{ error?: Error }> {
  const brokerUrl = getNativeBrokerUrl(state, attemptId);

  updateOauthDebug({
    redirectUri: getNativeAppCallbackUrl(),
    sentState: state,
    error: null,
    errorDescription: null,
    sessionApplied: null,
    deepLinkUrl: null,
    handoffToApp: true,
  });

  pushIosDebugLog("AppleAuth", "Opening broker directly in system browser with deep link callback", {
    brokerUrl,
    callbackUrl: getNativeAppCallbackUrl(),
    state,
    attemptId,
  });

  try {
    await openUrlOutsideApp(brokerUrl);
    return {};
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    clearPublishedAppleAttempt();
    updateOauthDebug({ error: error.message });
    pushIosDebugLog("AppleAuth", "Failed to open native broker URL", {
      brokerUrl,
      message: error.message,
    });
    return { error };
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

function startNativeBrokerAppleOAuth(attemptId: string, state: string): { error?: Error } {
  const brokerUrl = getNativeBrokerUrl(state, attemptId);

  updateOauthDebug({
    redirectUri: getNativeAppCallbackUrl(),
    sentState: state,
    error: null,
    errorDescription: null,
    sessionApplied: null,
    deepLinkUrl: null,
    handoffToApp: true,
  });

  pushIosDebugLog("AppleAuth", "Starting native broker Apple OAuth flow", {
    attemptId,
    state,
    brokerUrl,
    callbackUrl: getNativeAppCallbackUrl(),
  });

  window.location.href = brokerUrl;
  return {};
}

export async function startPublishedAppleSignIn(): Promise<{ error?: Error }> {
  const attemptId = getCurrentAttemptId() ?? createAttemptId();
  const state = getRequestedState() ?? createOAuthState();
  const alreadyStarted = getStoredAttemptId() === attemptId;

  if (alreadyStarted) {
    pushIosDebugLog("AppleAuth", "Skipped duplicate published Apple launch", {
      attemptId,
      href: typeof window !== "undefined" ? window.location.href : null,
    });
    return {};
  }

  markAttemptStarted(attemptId);
  markExpectedState(state);
  pushIosDebugLog("AppleAuth", "Starting published Apple launch", {
    attemptId,
    state,
    href: typeof window !== "undefined" ? window.location.href : null,
  });

  return startNativeBrokerAppleOAuth(attemptId, state);
}

export function clearPublishedAppleAttempt() {
  clearStoredAttempt();
  clearStoredOAuthState();
}

export async function nativeAppleSignIn(): Promise<{ error?: Error }> {
  try {
    markAppleUsernameSelectionPending();

    if (Capacitor.isNativePlatform()) {
      const attemptId = createAttemptId();
      const state = createOAuthState();
      markAttemptStarted(attemptId);
      markExpectedState(state);
      return await openNativeBrokerInSystemBrowser(attemptId, state);
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
