import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { applySessionFromUrl } from "@/lib/oauth-session";

const NATIVE_SCHEME = "app.lovable.wtracker";

const buildNativeCallbackUrl = (input: string): string => {
  const url = new URL(input);
  const params = new URLSearchParams(url.search);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

  hashParams.forEach((value, key) => {
    params.set(key, value);
  });

  const query = params.toString();
  return `${NATIVE_SCHEME}://oauth/callback${query ? `?${query}` : ""}`;
};

/**
 * Detects if the callback was opened from a native iOS app
 * and should redirect tokens back via custom URL scheme.
 */
const shouldRedirectToNativeApp = (): boolean => {
  const url = new URL(window.location.href);
  // Check if tokens are present (meaning this is a real OAuth callback)
  const hasCallbackState =
    url.searchParams.has("access_token") ||
    url.searchParams.has("refresh_token") ||
    url.searchParams.has("error") ||
    url.hash.includes("access_token") ||
    url.hash.includes("refresh_token") ||
    url.hash.includes("error");

  // Redirect any iOS browser callback back into the native app.
  const isIOSBrowser = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isNotWebView = !navigator.userAgent.includes("CapacitorWebView");

  return hasCallbackState && isIOSBrowser && isNotWebView;
};

const OAuthCallback = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [redirectedToApp, setRedirectedToApp] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const currentUrl = window.location.href;

        // If opened in Safari with tokens, redirect back to native app
        if (shouldRedirectToNativeApp()) {
          const nativeUrl = buildNativeCallbackUrl(currentUrl);

          console.log("Redirecting OAuth tokens to native app:", nativeUrl);
          setRedirectedToApp(true);
          window.location.href = nativeUrl;
          return;
        }

        // Standard web flow: apply session directly
        const appliedSession = await applySessionFromUrl(currentUrl);
        if (appliedSession) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const searchParams = new URLSearchParams(window.location.search);
        const error = searchParams.get("error");
        if (error) {
          console.error("OAuth error:", error, searchParams.get("error_description"));
        }
      } catch (e) {
        console.error("OAuth callback error:", e);
      }
      setProcessing(false);
    };

    handleCallback();
  }, []);

  useEffect(() => {
    if (redirectedToApp || processing || loading) return;
    navigate(user ? "/" : "/auth", { replace: true });
  }, [redirectedToApp, processing, loading, user, navigate]);

  if (redirectedToApp) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <div className="h-16 w-16 rounded-2xl gradient-gold flex items-center justify-center glow-gold mb-2">
          <span className="text-2xl">✓</span>
        </div>
        <p className="text-sm text-muted-foreground text-center px-8">
          Kirjautuminen onnistui! Palaa sovellukseen.
        </p>
        <button
          onClick={() => { window.location.href = `${NATIVE_SCHEME}://`; }}
          className="mt-4 text-gold underline text-sm"
        >
          Avaa sovellus
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">Signing you in...</p>
    </div>
  );
};

export default OAuthCallback;
