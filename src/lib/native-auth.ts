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

const PRODUCTION_URL = "https://status-level-up.lovable.app";
const OAUTH_INITIATE = "/~oauth/initiate";
const OAUTH_CALLBACK = "/~oauth/callback";

function createState(): string {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildNativeAppleAuthUrl(): string {
  const params = new URLSearchParams({
    provider: "apple",
    redirect_uri: `${PRODUCTION_URL}${OAUTH_CALLBACK}`,
    state: createState(),
  });

  return `${PRODUCTION_URL}${OAUTH_INITIATE}?${params.toString()}`;
}

async function startNativeIosAppleSignIn(): Promise<{ error?: Error }> {
  const { Browser } = await import("@capacitor/browser");
  const authUrl = buildNativeAppleAuthUrl();

  console.log("[AppleAuth] Starting native iOS sign-in via Browser.open:", authUrl);
  await Browser.open({ url: authUrl });

  return {};
}

export async function nativeAppleSignIn(): Promise<{ error?: Error }> {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
      return await startNativeIosAppleSignIn();
    }

    const { lovable } = await import("@/integrations/lovable/index");
    const redirectUri = `${PRODUCTION_URL}${OAUTH_CALLBACK}`;
    console.log("[AppleAuth] Starting web sign-in, redirect →", redirectUri);

    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: redirectUri,
    });

    if (result?.error) {
      console.error("[AppleAuth] Provider returned error:", result.error);
      return { error: result.error as Error };
    }

    return {};
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[AppleAuth] Unexpected error:", error);
    return { error };
  }
}
