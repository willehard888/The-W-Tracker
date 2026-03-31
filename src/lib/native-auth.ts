/**
 * Native Apple Sign-In (iOS)
 *
 * Uses Lovable Cloud's managed OAuth flow.
 * Apple requires an HTTPS redirect URI registered on the Service ID,
 * so we always route through the production web callback.
 * The OAuthCallback page detects the iOS browser and redirects tokens
 * back into the native app via the custom URL scheme.
 */

const PRODUCTION_URL = "https://status-level-up.lovable.app";
const OAUTH_CALLBACK = "/~oauth/callback";

export async function nativeAppleSignIn(): Promise<{ error?: Error }> {
  try {
    const { lovable } = await import("@/integrations/lovable/index");

    const redirectUri = `${PRODUCTION_URL}${OAUTH_CALLBACK}`;
    console.log("[AppleAuth] Starting sign-in, redirect →", redirectUri);

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
