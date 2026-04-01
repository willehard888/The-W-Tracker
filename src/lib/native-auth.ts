import { Capacitor } from "@capacitor/core";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { supabase } from "@/integrations/supabase/client";
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

/**
 * Native Apple Sign-In using the @capacitor-community/apple-sign-in plugin.
 * This provides a native iOS experience and is required for App Store approval.
 */
async function startNativeAppleSignIn(): Promise<{ error?: Error }> {
  try {
    console.log("[AppleAuth] Starting native iOS Apple Sign-In");
    pushIosDebugLog("AppleAuth", "Starting native Apple Sign-In flow");

    const result = await SignInWithApple.authorize({
      clientId: "app.lovable.wtracker", // This should match your Service ID or Bundle ID
      redirectURI: getNativeAppleRedirectUri(),
      scopes: "email name",
    });

    if (result.response && result.response.identityToken) {
      console.log("[AppleAuth] Native sign-in successful, signing in to Supabase");
      pushIosDebugLog("AppleAuth", "Native sign-in successful, sending to Supabase");

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: result.response.identityToken,
        // Optional: result.response.nonce if you provided one
      });

      if (error) {
        console.error("[AppleAuth] Supabase sign-in error:", error);
        pushIosDebugLog("AppleAuth", "Supabase sign-in error", error);
        return { error };
      }

      console.log("[AppleAuth] Supabase session established:", data.session?.user?.id);
      pushIosDebugLog("AppleAuth", "Supabase session established");
      return {};
    } else {
      throw new Error("No identity token received from Apple");
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    // Check if user cancelled
    if (error.message.includes("cancel") || (err as any).code === "1") {
      console.log("[AppleAuth] User cancelled sign-in");
      return {};
    }
    console.error("[AppleAuth] Native sign-in error:", error);
    pushIosDebugLog("AppleAuth", "Native sign-in error", error);
    return { error };
  }
}

/**
 * Fallback to web-based OAuth if native is not available or fails.
 */
async function startWebAppleSignIn(): Promise<{ error?: Error }> {
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
  pushIosDebugLog("AppleAuth", "Starting web OAuth flow", { redirectUri });

  const result = await lovable.auth.signInWithOAuth("apple", {
    redirect_uri: redirectUri,
  });

  if (result?.error) {
    console.error("[AppleAuth] Web provider returned error:", result.error);
    const message = errorMessage(result.error);
    updateOauthDebug({ error: message });
    pushIosDebugLog("AppleAuth", "Web OAuth error", result.error);
    return { error: result.error as Error };
  }

  return {};
}

export async function nativeAppleSignIn(): Promise<{ error?: Error }> {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
      return await startNativeAppleSignIn();
    }
    return await startWebAppleSignIn();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[AppleAuth] Unexpected error:", error);
    updateOauthDebug({ error: error.message });
    pushIosDebugLog("AppleAuth", "Unexpected OAuth exception", { message: error.message });
    return { error };
  }
}
