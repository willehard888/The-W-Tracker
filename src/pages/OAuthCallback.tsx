import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { applySessionFromUrl } from "@/lib/oauth-session";

const APP_SCHEME = "app.lovable.wtracker";

// ─── Helpers ────────────────────────────────────────────

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

/** True when the page has OAuth-related params. */
function hasOAuthParams(merged: URLSearchParams): boolean {
  return (
    merged.has("access_token") ||
    merged.has("refresh_token") ||
    merged.has("error")
  );
}

/** True when running in iOS Safari/Chrome (NOT inside Capacitor WebView). */
function isIOSExternalBrowser(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !ua.includes("CapacitorWebView");
}

// ─── Component ──────────────────────────────────────────

const OAuthCallback = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [sentToApp, setSentToApp] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const merged = mergeTokensToQuery(window.location.href);

        // ① iOS external browser → forward tokens to native app via URL scheme
        if (hasOAuthParams(merged) && isIOSExternalBrowser()) {
          const qs = merged.toString();
          const deepLink = `${APP_SCHEME}://oauth/callback${qs ? `?${qs}` : ""}`;
          console.log("[OAuthCB] Redirecting to native app:", deepLink);
          setSentToApp(true);
          window.location.href = deepLink;
          return;
        }

        // ② Web flow → apply session directly
        await applySessionFromUrl(window.location.href);

        // Log any OAuth error params
        const err = merged.get("error");
        if (err) {
          console.error("[OAuthCB] Error:", err, merged.get("error_description"));
        }
      } catch (e) {
        console.error("[OAuthCB] Unexpected:", e);
      }
      setProcessing(false);
    })();
  }, []);

  // Navigate once session is resolved
  useEffect(() => {
    if (sentToApp || processing || loading) return;
    navigate(user ? "/" : "/auth", { replace: true });
  }, [sentToApp, processing, loading, user, navigate]);

  // ─── Render ─────────────────────────────────────────

  if (sentToApp) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-8">
        <div className="h-16 w-16 rounded-2xl gradient-gold flex items-center justify-center glow-gold">
          <span className="text-2xl">✓</span>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Kirjautuminen onnistui! Palaa sovellukseen.
        </p>
        <button
          onClick={() => { window.location.href = `${APP_SCHEME}://`; }}
          className="text-gold underline text-sm"
        >
          Avaa sovellus
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
};

export default OAuthCallback;
