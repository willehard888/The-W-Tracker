import { Capacitor, registerPlugin } from "@capacitor/core";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";
import { clearAppleAuthStarted, clearAppleUsernameSelectionPending, markAppleAuthStarted } from "@/lib/apple-username";
import { supabase } from "@/integrations/supabase/client";

const PRODUCTION_URL = "https://status-level-up.lovable.app";
const WEB_OAUTH_CALLBACK = "/~oauth/callback";
const APPLE_AUTH_LAUNCH = "/apple-auth-launch";
const APP_SCHEME = "app.lovable.wtracker";
const PUBLISHED_LAUNCH_ATTEMPT_KEY = "w_apple_launch_attempt";

type NativeAppleSignInResult = {
  identityToken: string;
  authorizationCode?: string | null;
  nonce?: string | null;
  user?: string | null;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
};

type NativeAppleAuthPlugin = {
  signIn(): Promise<NativeAppleSignInResult>;
};

const NativeAppleAuth = registerPlugin<NativeAppleAuthPlugin>("NativeAppleAuth");

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

function getFriendlyAppleError(err: unknown): Error {
  const message = errorMessage(err).toLowerCase();

  if (
    message.includes("canceled") ||
    message.includes("cancelled") ||
    message.includes("authorizationerror error 1001") ||
    message.includes("user canceled") ||
    message.includes("user cancelled")
  ) {
    return new Error("APPLE_CANCELLED");
  }

  if (
    message.includes("network") ||
    message.includes("internet") ||
    message.includes("offline") ||
    message.includes("timed out")
  ) {
    return new Error("Connection error. Try again.");
  }

  return new Error("Apple sign-in failed. Please try again.");
}

async function signInWithAppleIdToken(identityToken: string, nonce?: string | null) {
  return supabase.auth.signInWithIdToken({
    provider: "apple",
    token: identityToken,
    nonce: nonce ?? undefined,
  });
}

async function nativeDirectAppleSignIn(): Promise<{ error?: Error }> {
  try {
    // Check if the native NativeAppleAuth plugin is actually registered.
    // If not (which is the case in our current iOS build, since we don't
    // ship a Swift implementation of it), fall back to the managed OAuth
    // flow which opens Apple Sign In in Safari/ASWebAuthenticationSession.
    const isPluginAvailable = Capacitor.isPluginAvailable("NativeAppleAuth");
    if (!isPluginAvailable) {
      pushIosDebugLog("AppleAuth", "NativeAppleAuth plugin not available, using managed OAuth", {
        platform: Capacitor.getPlatform(),
      });
      return await startManagedAppleOAuth();
    }

    const credentials = await NativeAppleAuth.signIn();

    if (!credentials?.identityToken) {
      clearAppleAuthStarted();
      clearAppleUsernameSelectionPending();
      return { error: new Error("Apple sign-in failed. Please try again.") };
    }

    const { data, error } = await signInWithAppleIdToken(credentials.identityToken, credentials.nonce);

    if (error) {
      clearAppleAuthStarted();
      clearAppleUsernameSelectionPending();
      return { error: new Error("Apple sign-in failed. Please try again.") };
    }

    const provider = data.user?.app_metadata?.provider;
    const providers = Array.isArray(data.user?.app_metadata?.providers)
      ? data.user?.app_metadata?.providers
      : [];
    const isAppleUser = provider === "apple" || providers.includes("apple");
    const identities = Array.isArray(data.user?.identities) ? data.user.identities : [];
    const hasNonAppleIdentity = identities.some((identity) => identity.provider && identity.provider !== "apple");
    const providerAssignedUsername = data.user?.user_metadata?.username;
    if (isAppleUser && !hasNonAppleIdentity) {
      markAppleAuthStarted();
    } else {
      clearAppleAuthStarted();
      clearAppleUsernameSelectionPending();
    }

    return {};
  } catch (err) {
    clearAppleAuthStarted();
    clearAppleUsernameSelectionPending();
    return { error: getFriendlyAppleError(err) };
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
    if (Capacitor.isNativePlatform()) {
      return await nativeDirectAppleSignIn();
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
