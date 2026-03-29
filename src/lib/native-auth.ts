import { isNativePlatform } from "@/lib/platform";

const PRODUCTION_URL = "https://status-level-up.lovable.app";

/**
 * Apple Sign-In via Lovable Cloud managed OAuth.
 * 
 * On native iOS: uses production URL as redirect so the in-app browser
 * redirects to the published app's /~oauth route. The Capacitor app 
 * listener in main.tsx intercepts this and sets the session.
 * 
 * On web: uses current origin.
 */
export const nativeAppleSignIn = async (): Promise<{ error?: Error }> => {
  try {
    const { lovable } = await import("@/integrations/lovable/index");

    // Native must redirect to published domain, not capacitor://localhost
    const redirectUri = isNativePlatform()
      ? PRODUCTION_URL
      : window.location.origin;

    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: redirectUri,
    });

    if (result?.error) return { error: result.error as Error };
    return {};
  } catch (e: any) {
    console.error("Apple sign-in error:", e);
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
};
