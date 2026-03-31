const PRODUCTION_URL = "https://status-level-up.lovable.app";
const OAUTH_CALLBACK_PATH = "/~oauth/callback";

/**
 * Apple Sign-In via Lovable Cloud managed OAuth.
 *
 * Apple web auth requires an HTTPS redirect URI registered on the Service ID.
 * Using the native app URL scheme here causes Apple's "invalid web redirect url"
 * error, so we always send users through the production callback.
 */
export const nativeAppleSignIn = async (): Promise<{ error?: Error }> => {
  try {
    const { lovable } = await import("@/integrations/lovable/index");

    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: `${PRODUCTION_URL}${OAUTH_CALLBACK_PATH}`,
    });

    if (result?.error) return { error: result.error as Error };
    return {};
  } catch (e: any) {
    console.error("Apple sign-in error:", e);
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
};
