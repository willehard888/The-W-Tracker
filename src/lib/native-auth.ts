import { isNativePlatform } from "@/lib/platform";

const PRODUCTION_URL = "https://status-level-up.lovable.app";
const OAUTH_CALLBACK_PATH = "/~oauth/callback";
const NATIVE_OAUTH_REDIRECT_URI = "app.lovable.wtracker://~oauth/callback";

const isPreviewHost = (hostname: string): boolean => {
  return hostname.includes("-preview--") || hostname.includes(".lovableproject.com");
};

/**
 * Apple Sign-In via Lovable Cloud managed OAuth.
 *
 * Native app uses the registered app URL scheme so iOS can hand the callback
 * directly back to Capacitor. Preview still routes through production to avoid
 * preview proxy issues.
 */
export const nativeAppleSignIn = async (): Promise<{ error?: Error }> => {
  try {
    const { lovable } = await import("@/integrations/lovable/index");

    const redirectUri = isNativePlatform()
      ? NATIVE_OAUTH_REDIRECT_URI
      : `${isPreviewHost(window.location.hostname) ? PRODUCTION_URL : window.location.origin}${OAUTH_CALLBACK_PATH}`;

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
