import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts access_token and refresh_token from both URL search params
 * and hash fragment (Apple/OAuth providers use either).
 */
function extractTokens(url: URL) {
  const search = new URLSearchParams(url.search);
  const hash = new URLSearchParams(
    url.hash.startsWith("#") ? url.hash.slice(1) : url.hash,
  );

  return {
    accessToken: search.get("access_token") ?? hash.get("access_token"),
    refreshToken: search.get("refresh_token") ?? hash.get("refresh_token"),
  };
}

/**
 * Apply an OAuth session from any URL that contains token params.
 * Works for both web callbacks and native deep-link URLs.
 */
export async function applySessionFromUrl(
  input: string | URL,
): Promise<boolean> {
  try {
    const url = input instanceof URL ? input : new URL(input, window.location.origin);
    const { accessToken, refreshToken } = extractTokens(url);

    if (!accessToken || !refreshToken) {
      console.log("[OAuth] No tokens found in URL");
      return false;
    }

    console.log("[OAuth] Applying session from URL tokens");
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;

    console.log("[OAuth] Session applied successfully");
    return true;
  } catch (err) {
    console.error("[OAuth] Failed to apply session:", err);
    return false;
  }
}
