/**
 * Native Apple Sign-In (iOS)
 *
 * Root cause of the previous failure:
 * the Lovable auth SDK uses a popup-oriented flow unless it detects a
 * specific mobile-app user agent. In Capacitor iOS that detection does not
 * reliably happen, so Safari handoff was interpreted as "Sign in was cancelled".
 *
 * Fix:
 * for native iOS we bypass the popup flow entirely and open the managed
 * OAuth initiate URL in Capacitor Browser, then return to the app through
 * the existing custom URL scheme + deep-link session handler.
 */

import { Capacitor } from "@capacitor/core";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";

const PRODUCTION_URL = "https://status-level-up.lovable.app";
const OAUTH_CALLBACK = "/~oauth/callback";
const APP_SCHEME = "app.lovable.wtracker";

function getWebAppleRedirectUri(): string {
  return `${PRODUCTION_URL}${OAUTH_CALLBACK}`;
}

function getNativeAppleRedirectUri(): string {
  return `${APP_SCHEME}://oauth/callback`;
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

async function startNativeIosAppleSignIn(): Promise<{ error?: Error }> {
  const { lovable } = await import("@/integrations/lovable/index");
  const redirectUri = getNativeAppleRedirectUri();

  updateOauthDebug({
    redirectUri,
    sentState: null,
    error: null,
    errorDescription: null,
    sessionApplied: null,
    deepLinkUrl: null,
    handoffToApp: false,
  });

  console.log("[AppleAuth] Starting native iOS sign-in via Lovable OAuth redirect:", redirectUri);
  pushIosDebugLog("AppleAuth", "Starting native iOS OAuth flow", {
    redirectUri,
    sentState: null,
  });

  const result = await lovable.auth.signInWithOAuth("apple", {
    redirect_uri: redirectUri,
  });

  if (result?.error) {
    console.error("[AppleAuth] Native provider returned error:", result.error);
    const message = errorMessage(result.error);
    updateOauthDebug({ error: message });
    pushIosDebugLog("AppleAuth", "Native iOS OAuth error", result.error);
    return { error: result.error as Error };
  }

  pushIosDebugLog("AppleAuth", "Native iOS OAuth redirect started", {
    redirected: result?.redirected ?? true,
  });

  return {};
}

export async function nativeAppleSignIn(): Promise<{ error?: Error }> {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
      return await startNativeIosAppleSignIn();
    }

    const { lovable } = await import("@/integrations/lovable/index");
    const redirectUri = getWebAppleRedirectUri();

    updateOauthDebug({
      redirectUri,
      sentState: null,
      error: null,
      errorDescription: null,
      sessionApplied: null,
      deepLinkUrl: null,
      handoffToApp: false,
    });

    console.log("[AppleAuth] Starting web sign-in, redirect →", redirectUri);
    pushIosDebugLog("AppleAuth", "Starting web OAuth flow", {
      redirectUri,
      sentState: null,
    });

    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: redirectUri,
    });

    if (result?.error) {
      console.error("[AppleAuth] Provider returned error:", result.error);
      const message = errorMessage(result.error);
      updateOauthDebug({ error: message });
      pushIosDebugLog("AppleAuth", "Web OAuth error", result.error);
      return { error: result.error as Error };
    }

    pushIosDebugLog("AppleAuth", "Web OAuth redirect started", {
      redirected: result?.redirected ?? true,
    });

    return {};
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[AppleAuth] Unexpected error:", error);
    updateOauthDebug({ error: error.message });
    pushIosDebugLog("AppleAuth", "Unexpected OAuth exception", {
      message: error.message,
    });
    return { error };
  }
}
