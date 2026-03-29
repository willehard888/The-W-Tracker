import { isNativePlatform } from "@/lib/platform";

/**
 * Apple Sign-In via Lovable Cloud managed OAuth on all platforms.
 * Uses published domain on native to avoid localhost/capacitor callback issues.
 */
export const nativeAppleSignIn = async (): Promise<{ error?: Error }> => {
  try {
    const { lovable } = await import("@/integrations/lovable/index");

    const redirectOrigin = isNativePlatform()
      ? "https://status-level-up.lovable.app"
      : window.location.origin;

    // Pass only origin; OAuth handler resolves callback path itself.
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: redirectOrigin,
    });

    if (result?.error) return { error: result.error as Error };
    return {};
  } catch (e: any) {
    console.error("Apple sign-in error:", e);
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
};
