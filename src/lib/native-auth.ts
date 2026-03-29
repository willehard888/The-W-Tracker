/**
 * Apple Sign-In via Lovable Cloud managed OAuth on all platforms.
 * This avoids native SPM plugin version conflicts in Capacitor iOS builds.
 */
export const nativeAppleSignIn = async (): Promise<{ error?: Error }> => {
  try {
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: `${window.location.origin}/~oauth`,
    });

    if (result?.error) return { error: result.error as Error };
    return {};
  } catch (e: any) {
    console.error("Apple sign-in error:", e);
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
};
