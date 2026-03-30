import { isNativePlatform } from "@/lib/platform";

const PRODUCTION_URL = "https://status-level-up.lovable.app";
const OAUTH_CALLBACK_PATH = "/~oauth/callback";

const isPreviewHost = (hostname: string): boolean => {
  return hostname.includes("-preview--") || hostname.includes(".lovableproject.com");
};

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

    // Route OAuth to production callback when native OR preview to avoid preview auth proxy issues.
    const redirectBase =
      isNativePlatform() || isPreviewHost(window.location.hostname)
        ? PRODUCTION_URL
        : window.location.origin;
    const redirectUri = `${redirectBase}${OAUTH_CALLBACK_PATH}`;

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
