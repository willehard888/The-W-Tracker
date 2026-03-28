import { isNativePlatform, getPlatform } from "@/lib/platform";
import { supabase } from "@/integrations/supabase/client";

/**
 * Native Google Sign-In using @codetrix-studio/capacitor-google-auth
 * Falls back to Lovable Cloud OAuth on web.
 */
export const nativeGoogleSignIn = async (): Promise<{ error?: Error }> => {
  if (!isNativePlatform()) {
    // On web, use Lovable Cloud managed OAuth
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result?.error) return { error: result.error as Error };
    return {};
  }

  try {
    const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");

    // Initialize (no-op if already initialized)
    await GoogleAuth.initialize({
      clientId: "", // Set your Google Web Client ID here for production
      scopes: ["profile", "email"],
      grantOfflineAccess: true,
    });

    const user = await GoogleAuth.signIn();

    if (!user.authentication?.idToken) {
      return { error: new Error("No ID token received from Google") };
    }

    // Exchange the Google ID token for a Supabase session
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: user.authentication.idToken,
    });

    if (error) return { error };
    return {};
  } catch (e: any) {
    console.error("Native Google sign-in error:", e);
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
};

/**
 * Native Apple Sign-In using @capacitor-community/apple-sign-in
 * Falls back to Lovable Cloud OAuth on web.
 */
export const nativeAppleSignIn = async (): Promise<{ error?: Error }> => {
  if (!isNativePlatform() || getPlatform() !== "ios") {
    // On web or Android, use Lovable Cloud managed OAuth
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (result?.error) return { error: result.error as Error };
    return {};
  }

  try {
    const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");

    const result = await SignInWithApple.authorize({
      clientId: "app.lovable.wtracker",
      redirectURI: "https://zjdljojkgrpgxurugixf.supabase.co/auth/v1/callback",
      scopes: "email name",
      state: crypto.randomUUID(),
      nonce: crypto.randomUUID(),
    });

    if (!result.response?.identityToken) {
      return { error: new Error("No identity token received from Apple") };
    }

    // Exchange the Apple identity token for a Supabase session
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: result.response.identityToken,
    });

    if (error) return { error };
    return {};
  } catch (e: any) {
    console.error("Native Apple sign-in error:", e);
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
};
