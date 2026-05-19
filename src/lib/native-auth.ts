import { Capacitor, registerPlugin } from "@capacitor/core";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";
import {
  clearAppleAuthStarted,
  clearAppleUsernameSelectionPending,
  markAppleAuthStarted,
} from "@/lib/apple-username";
import { supabase } from "@/integrations/supabase/client";

const PRODUCTION_URL = "https://status-level-up.lovable.app";
const WEB_OAUTH_CALLBACK = "/auth/callback";
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
  signIn(options?: { scopes?: string[] }): Promise<NativeAppleSignInResult>;
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
  const message = errorMessage(err);
  const lower = message.toLowerCase();

  if (
    lower.includes("apple_cancelled") ||
    lower.includes("canceled") ||
    lower.includes("cancelled") ||
    lower.includes("authorizationerror error 1001") ||
    lower.includes("user canceled") ||
    lower.includes("user cancelled")
  ) {
    return new Error("APPLE_CANCELLED");
  }

  if (
    lower.includes("network") ||
    lower.includes("internet") ||
    lower.includes("offline") ||
    lower.includes("timed out")
  ) {
    return new Error("Connection error. Try again.");
  }

  // Pass through informative messages from the native side (already HIG-friendly).
  if (message && message !== "Apple sign-in failed. Please try again.") {
    return new Error(message);
  }

  return new Error("Sign in with Apple failed. Please try again.");
}

/**
 * Reset every piece of state that could prevent a fresh Apple sign-in.
 * Called BEFORE every attempt so logout → relogin always works.
 */
function resetAppleAuthState() {
  clearAppleAuthStarted();
  clearAppleUsernameSelectionPending();
  clearStoredAttempt();
}

async function signInWithAppleIdToken(identityToken: string, nonce?: string | null) {
  return supabase.auth.signInWithIdToken({
    provider: "apple",
    token: identityToken,
    nonce: nonce ?? undefined,
  });
}

async function nativeDirectAppleSignIn(options?: { hideEmail?: boolean }): Promise<{ error?: Error }> {
  // Always start from a clean slate so a previous successful sign-in
  // (or aborted one) cannot block the next attempt.
  resetAppleAuthState();

  try {
    const isPluginAvailable = Capacitor.isPluginAvailable("NativeAppleAuth");
    if (!isPluginAvailable) {
      // NativeAppleAuth pod isn't bundled in this build (TestFlight build 14+
      // ships without the native ASAuthorizationController plugin). Fall back
      // to the managed OAuth flow — opens Safari View Controller, completes
      // the Apple OAuth dance against the published callback URL, and deep
      // links the session back to the app via the `app://` URL scheme.
      // Both flows end with the same Supabase session; only the UX differs
      // (native sheet vs. Safari handoff).
      pushIosDebugLog("AppleAuth", "NativeAppleAuth plugin not available — falling back to managed OAuth", {
        platform: Capacitor.getPlatform(),
      });
      resetAppleAuthState();
      return await startManagedAppleOAuth();
    }

    // Apple's "Hide My Email" toggle is shown automatically when `email` is
    // in `requestedScopes`. If the caller asks us to skip the email scope,
    // Apple will sign the user in without revealing or relaying any email.
    const scopes = options?.hideEmail ? ["fullName"] : ["fullName", "email"];
    pushIosDebugLog("AppleAuth", "Calling native NativeAppleAuth.signIn", { scopes });

    const credentials = await NativeAppleAuth.signIn({ scopes });

    if (!credentials?.identityToken) {
      pushIosDebugLog("AppleAuth", "Native plugin returned no identity token");
      return { error: new Error("Apple sign-in failed. Please try again.") };
    }

    pushIosDebugLog("AppleAuth", "Native plugin succeeded, exchanging with Supabase", {
      hasNonce: Boolean(credentials.nonce),
      hasEmail: Boolean(credentials.email),
    });

    const { data, error } = await signInWithAppleIdToken(
      credentials.identityToken,
      credentials.nonce,
    );

    if (error) {
      pushIosDebugLog("AppleAuth", "Supabase signInWithIdToken failed", {
        message: error.message,
      });
      return { error: new Error("Apple sign-in failed. Please try again.") };
    }

    const provider = data.user?.app_metadata?.provider;
    const providers = Array.isArray(data.user?.app_metadata?.providers)
      ? data.user?.app_metadata?.providers
      : [];
    const isAppleUser = provider === "apple" || providers.includes("apple");
    const identities = Array.isArray(data.user?.identities) ? data.user.identities : [];
    const hasNonAppleIdentity = identities.some(
      (identity) => identity.provider && identity.provider !== "apple",
    );

    if (isAppleUser && !hasNonAppleIdentity) {
      markAppleAuthStarted();
    }

    pushIosDebugLog("AppleAuth", "Native Apple sign-in completed", {
      userId: data.user?.id,
      isAppleUser,
    });

    return {};
  } catch (err) {
    pushIosDebugLog("AppleAuth", "Native Apple sign-in threw", {
      message: errorMessage(err),
    });
    return { error: getFriendlyAppleError(err) };
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
    usingPublishedCallback: redirectUri.startsWith(`${PRODUCTION_URL}${WEB_OAUTH_CALLBACK}`),
    forceNativeHandoff: shouldForceNativeHandoff(),
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
    });
    return {};
  }

  markAttemptStarted(attemptId);
  pushIosDebugLog("AppleAuth", "Starting published Apple launch", { attemptId });

  return startManagedAppleOAuth();
}

export function clearPublishedAppleAttempt() {
  clearStoredAttempt();
}

export async function nativeAppleSignIn(options?: { hideEmail?: boolean }): Promise<{ error?: Error }> {
  try {
    // 1. Native iOS / Android: always use the native Apple plugin so the user
    //    sees Apple's own native sheet with Face ID / Touch ID — no browser.
    if (Capacitor.isNativePlatform()) {
      return await nativeDirectAppleSignIn(options);
    }

    // 2. Non-production preview: redirect to the published auth page so Apple
    //    accepts the redirect_uri (Apple requires a registered domain).
    if (shouldUsePublishedAuthPage()) {
      resetAppleAuthState();
      redirectToPublishedAuthPage();
      return {};
    }

    // 3. Production web: start managed OAuth directly.
    resetAppleAuthState();
    return await startManagedAppleOAuth();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[AppleAuth] Unexpected error:", error);
    updateOauthDebug({ error: error.message });
    pushIosDebugLog("AppleAuth", "Unexpected OAuth exception", { message: error.message });
    return { error };
  }
}
