import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { applySessionFromUrl } from "@/lib/oauth-session";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";
import { clearPublishedAppleAttempt } from "@/lib/native-auth";
import { toast } from "sonner";

const APP_SCHEME = "app.lovable.wtracker";

function getRequestedAppScheme(merged: URLSearchParams): string {
  return merged.get("app_scheme") || APP_SCHEME;
}

function shouldForceNativeHandoff(merged: URLSearchParams): boolean {
  return merged.get("native_handoff") === "1";
}

function buildNativeCallbackUrl(merged: URLSearchParams): string {
  const scheme = getRequestedAppScheme(merged);
  const qs = merged.toString();
  return `${scheme}://oauth/callback${qs ? `?${qs}` : ""}`;
}

function buildAppCallbackUrlFromCurrentLocation() {
  const url = new URL(window.location.href);
  const merged = mergeTokensToQuery(url.toString());
  return buildNativeCallbackUrl(merged);
}

function openNativeApp(deepLink: string) {
  window.location.replace(deepLink);

  window.setTimeout(() => {
    try {
      window.location.assign(deepLink);
    } catch {
      // no-op
    }
  }, 700);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

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
        const oauthError = merged.get("error");
        const oauthErrorDescription = merged.get("error_description");

        updateOauthDebug({
          callbackUrl: window.location.href,
          callbackPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
          callbackAt: new Date().toISOString(),
          returnedState: merged.get("state"),
          error: oauthError,
          errorDescription: oauthErrorDescription,
          hasAccessToken: merged.has("access_token"),
          hasRefreshToken: merged.has("refresh_token"),
          handoffToApp: false,
          deepLinkUrl: null,
          sessionApplied: null,
        });

        pushIosDebugLog("OAuthCallback", "Callback opened", {
          pathname: window.location.pathname,
          hasAccessToken: merged.has("access_token"),
          hasRefreshToken: merged.has("refresh_token"),
          state: merged.get("state"),
          error: oauthError,
        });

        // ① iOS external browser → forward tokens to native app via URL scheme
        if (hasOAuthParams(merged) && (isIOSExternalBrowser() || shouldForceNativeHandoff(merged))) {
          const deepLink = buildAppCallbackUrlFromCurrentLocation();
          console.log("[OAuthCB] Redirecting to native app:", deepLink);
          clearPublishedAppleAttempt();
          updateOauthDebug({
            callbackUrl: window.location.href,
            deepLinkUrl: deepLink,
            handoffToApp: true,
          });
          pushIosDebugLog("OAuthCallback", "Forwarding callback to app deep link", {
            deepLink,
          });
          setSentToApp(true);
          openNativeApp(deepLink);
          return;
        }

        // ② Web flow → apply session directly
        const sessionApplied = await applySessionFromUrl(window.location.href);
        clearPublishedAppleAttempt();
        updateOauthDebug({ sessionApplied });
        pushIosDebugLog("OAuthCallback", "Session apply result", {
          sessionApplied,
        });

        // Log any OAuth error params
        if (oauthError) {
          console.error("[OAuthCB] Error:", oauthError, oauthErrorDescription);
          toast.error(`Sign in failed: ${oauthErrorDescription || oauthError}`);
          pushIosDebugLog("OAuthCallback", "OAuth provider error in callback", {
            error: oauthError,
            errorDescription: oauthErrorDescription,
          });
        }

        if (!sessionApplied && !oauthError && !sentToApp) {
          clearPublishedAppleAttempt();
          toast.error("Session could not be established. Please try again.");
        }
      } catch (e) {
        console.error("[OAuthCB] Unexpected:", e);
        const message = getErrorMessage(e);
        toast.error(`Sign in error: ${message}`);
        clearPublishedAppleAttempt();
        updateOauthDebug({ error: message });
        pushIosDebugLog("OAuthCallback", "Unexpected callback exception", {
          message,
        });
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
          onClick={() => {
              openNativeApp(buildAppCallbackUrlFromCurrentLocation());
          }}
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
