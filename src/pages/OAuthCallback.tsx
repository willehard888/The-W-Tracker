import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { applySessionFromUrl } from "@/lib/oauth-session";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";
import { clearPublishedAppleAttempt } from "@/lib/native-auth";
import { toast } from "sonner";

// SECURITY: this page previously had a "native handoff" branch that forwarded
// the OAuth access + refresh tokens to a custom URL scheme
// (app_scheme://oauth/callback?access_token=…). The scheme was caller-
// controlled and unvalidated (redirect + token theft), and the app never even
// registered it. It was also dead code — native Apple Sign-In runs entirely
// through src/lib/native-auth.ts (SignInWithApple + signInWithIdToken) and
// never round-trips tokens through a browser. The whole branch is removed.

/** Merge hash-fragment params into query params (Apple puts tokens in hash). */
function mergeTokensToQuery(href: string): URLSearchParams {
  const url = new URL(href);
  const merged = new URLSearchParams(url.search);
  const hash = new URLSearchParams(
    url.hash.startsWith("#") ? url.hash.slice(1) : url.hash,
  );
  hash.forEach((v, k) => merged.set(k, v));
  return merged;
}

const OAuthCallback = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const merged = mergeTokensToQuery(window.location.href);
        const oauthError = merged.get("error");
        const oauthErrorDescription = merged.get("error_description");

        // Never persist the raw callback URL — it carries the tokens in its
        // hash. Only the presence booleans are useful for debugging.
        updateOauthDebug({
          callbackAt: new Date().toISOString(),
          returnedState: merged.get("state"),
          error: oauthError,
          errorDescription: oauthErrorDescription,
          hasAccessToken: merged.has("access_token"),
          hasRefreshToken: merged.has("refresh_token"),
          sessionApplied: null,
        });

        pushIosDebugLog("OAuthCallback", "Callback opened", {
          hasAccessToken: merged.has("access_token"),
          hasRefreshToken: merged.has("refresh_token"),
          state: merged.get("state"),
          error: oauthError,
        });

        // Web flow → apply session directly.
        const sessionApplied = await applySessionFromUrl(window.location.href);
        clearPublishedAppleAttempt();
        updateOauthDebug({ sessionApplied });
        pushIosDebugLog("OAuthCallback", "Session apply result", { sessionApplied });

        if (oauthError) {
          console.error("[OAuthCB] Error:", oauthError, oauthErrorDescription);
          toast.error("Apple sign-in failed. Please try again.");
        }

        if (!sessionApplied && !oauthError) {
          clearPublishedAppleAttempt();
          toast.error("Connection error. Try again.");
        }
      } catch (e) {
        console.error("[OAuthCB] Unexpected:", e);
        toast.error("Connection error. Try again.");
        clearPublishedAppleAttempt();
        updateOauthDebug({ error: "Connection error. Try again." });
      }
      setProcessing(false);
    })();
  }, []);

  useEffect(() => {
    if (processing || loading) return;
    navigate(user ? "/" : "/auth", { replace: true });
  }, [processing, loading, user, navigate]);

  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
};

export default OAuthCallback;
