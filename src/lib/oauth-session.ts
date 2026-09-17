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

/** The user id a Supabase access token was issued to (payload `sub`), or null. Not a verification. */
export const tokenSubject = (accessToken: string): string | null => {
  try {
    const seg = accessToken.split(".")[1] ?? "";
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const sub = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)))?.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
};

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

    if (!accessToken || !refreshToken) return false;

    // A link cannot replace a signed-in member with someone else. Any app or
    // page can open the app's URL with a token pair; without this, a member's
    // next check-ins, photos and journal entries went into the account the
    // link's author chose. Sign-in itself never comes through here (Apple is
    // native, email is a form); what does is password recovery, which is for
    // the same member or for nobody signed in.
    const { data: current } = await supabase.auth.getSession();
    if (current.session && tokenSubject(accessToken) !== current.session.user.id) {
      console.warn("[OAuth] Refused a session for a different account");
      return false;
    }

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[OAuth] Failed to apply session:", err);
    return false;
  }
}
