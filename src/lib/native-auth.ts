/**
 * Apple Sign-In via Lovable Cloud managed OAuth on all platforms.
 * This avoids native SPM plugin version conflicts in Capacitor iOS builds.
 */
export const nativeAppleSignIn = async (): Promise<{ error?: Error }> => {
  try {
    const { lovable } = await import("@/integrations/lovable/index");

    // On native Capacitor, window.location.origin is "capacitor://localhost"
    // which won't work for OAuth redirects. Use the published web URL instead.
    const isCapacitor = window.location.origin.includes("capacitor://") || window.location.origin.includes("localhost");
    const redirectOrigin = isCapacitor
      ? "https://status-level-up.lovable.app"
      : window.location.origin;

    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: `${redirectOrigin}/~oauth`,
    });

    if (result?.error) return { error: result.error as Error };
    return {};
  } catch (e: any) {
    console.error("Apple sign-in error:", e);
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
};
