import { Capacitor } from "@capacitor/core";
import { SignInWithApple, type SignInWithAppleResponse } from "@capacitor-community/apple-sign-in";
import { pushIosDebugLog, updateOauthDebug } from "@/lib/ios-debug";
import {
  clearAppleAuthStarted,
  clearAppleUsernameSelectionPending,
  markAppleAuthStarted,
} from "@/lib/apple-username";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Native Sign in with Apple via @capacitor-community/apple-sign-in (v7.x).
//
// Flow:
//   1. Generate raw nonce (UUID) + SHA-256 hashed nonce.
//   2. Call SignInWithApple.authorize({ ..., nonce: hashedNonce }) — opens
//      Apple's native ASAuthorizationController sheet on iOS (Face ID inline).
//   3. Apple returns an identityToken JWT bound to the hashed nonce.
//   4. Hand identityToken + RAW nonce to supabase.auth.signInWithIdToken;
//      Supabase hashes the raw nonce and verifies it matches the JWT.
//
// No Safari View Controller. No third-party redirect. No Lovable. The only
// network call is between the iOS app and Apple → Supabase.
//
// Apple App Review (Guideline 4.8) requires native Sign in with Apple when
// the app offers any third-party login. This implementation satisfies that.
// ─────────────────────────────────────────────────────────────────────────────

// Bundle ID on iOS = Apple Services clientId for native flow. (For web you'd
// configure a Services ID in Apple Developer Portal and pass that string.)
const APPLE_CLIENT_ID = "app.lovable.wtracker";

// Web fallback — when running in a browser (no Capacitor native context),
// SignInWithApple uses Apple JS SDK and requires a real https redirect URI.
// We send to a dedicated callback path served by the Vercel deploy.
const WEB_REDIRECT_URI =
  typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : "https://wtracker.app/auth/callback";

// ────────────────────────────────────────────────────────────────────
// Nonce helpers — raw uuid sent to Supabase, sha256(raw) sent to Apple.
// ────────────────────────────────────────────────────────────────────

function generateRawNonce(): string {
  // crypto.randomUUID is available in modern Safari WKWebView (iOS 15+),
  // which matches our deployment target.
  return crypto.randomUUID();
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ────────────────────────────────────────────────────────────────────
// Error helpers — translate Apple error codes into HIG-friendly text.
// ────────────────────────────────────────────────────────────────────

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function getFriendlyAppleError(err: unknown): Error {
  const message = errorMessage(err);
  const lower = message.toLowerCase();

  // ASAuthorizationErrorCanceled = 1001
  if (
    lower.includes("1001") ||
    lower.includes("cancel") ||
    lower.includes("user canceled") ||
    lower.includes("user cancelled")
  ) {
    return new Error("APPLE_CANCELLED");
  }
  // ASAuthorizationErrorInvalidResponse = 1003
  if (lower.includes("1003") || lower.includes("invalid response")) {
    return new Error("Apple sign-in returned an invalid response.");
  }
  // ASAuthorizationErrorNotHandled = 1004
  if (lower.includes("1004") || lower.includes("not handled")) {
    return new Error(
      "iOS couldn't handle this Apple sign-in. Check that you're signed into Apple ID in Settings.",
    );
  }
  // ASAuthorizationErrorFailed = 1000 (generic; usually capability/profile issue)
  if (lower.includes("1000") || lower.includes("authorizationerror")) {
    return new Error(
      "Apple sign-in failed. Try again — if it keeps failing, sign out of Apple ID in Settings and back in.",
    );
  }
  if (
    lower.includes("network") ||
    lower.includes("offline") ||
    lower.includes("timed out")
  ) {
    return new Error("Connection error. Try again.");
  }
  return new Error("Sign in with Apple failed. Please try again.");
}

// ────────────────────────────────────────────────────────────────────
// State reset — called before every attempt so logout → relogin works.
// ────────────────────────────────────────────────────────────────────

function resetAppleAuthState() {
  clearAppleAuthStarted();
  clearAppleUsernameSelectionPending();
}

// ────────────────────────────────────────────────────────────────────
// Core sign-in — same code path on iOS native + web.
// ────────────────────────────────────────────────────────────────────

async function performAppleSignIn(options?: {
  hideEmail?: boolean;
}): Promise<{ error?: Error }> {
  resetAppleAuthState();

  try {
    const rawNonce = generateRawNonce();
    const hashedNonce = await sha256Hex(rawNonce);
    const scopes = options?.hideEmail ? "name" : "email name";
    const isNative = Capacitor.isNativePlatform();

    // Apple Sign In nonce protocol (verified against plugin source +
    // Apple's official sample code at developer.apple.com):
    //
    // The @capacitor-community/apple-sign-in iOS plugin (Plugin.swift line 18)
    // passes `request.nonce = call.getString("nonce")` VERBATIM — no hashing.
    // Apple's own sample (developer.apple.com/...sign_in_with_apple) calls
    // `request.nonce = sha256(rawNonce)` and stores rawNonce client-side for
    // later verification. So we must pre-hash before passing to the plugin.
    //
    // Then Apple's server stores OUR submitted nonce (which is sha256(raw))
    // in the JWT verbatim. Supabase hashes the rawNonce we send and compares
    // sha256(rawNonce) to JWT.nonce — they match because JWT.nonce IS
    // sha256(rawNonce).
    //
    // For web, the @apple/sign-in-with-apple JS SDK behaves the same way:
    // it does NOT hash; we send hashed → Apple stores hashed → matches.
    //
    // Same recipe on both platforms:
    const nonceForApple = hashedNonce;

    updateOauthDebug({
      redirectUri: isNative ? "(native)" : WEB_REDIRECT_URI,
      sentState: hashedNonce,
      error: null,
      errorDescription: null,
      sessionApplied: null,
      handoffToApp: false,
    });

    pushIosDebugLog("AppleAuth", "Calling SignInWithApple.authorize", {
      platform: Capacitor.getPlatform(),
      scopes,
      rawNoncePreview: rawNonce.slice(0, 8) + "…",
      hashedNoncePreview: hashedNonce.slice(0, 16) + "…",
    });

    const response: SignInWithAppleResponse = await SignInWithApple.authorize({
      clientId: APPLE_CLIENT_ID,
      redirectURI: WEB_REDIRECT_URI,
      scopes,
      nonce: nonceForApple,
      // state can be any string Apple echoes back. We use the hashed nonce
      // so it's a non-correlatable opaque token to the user.
      state: hashedNonce.slice(0, 32),
    });

    const identityToken = response?.response?.identityToken;

    if (!identityToken) {
      pushIosDebugLog("AppleAuth", "Apple returned no identityToken", response);
      return { error: new Error("Apple sign-in failed. Please try again.") };
    }

    // Decode the JWT.nonce claim so we can SEE what Apple actually stored.
    // base64url → base64 conversion + correct PKCS#7-style padding (the
    // earlier attempt over-padded on length % 4 === 0 and under-padded on
    // length % 4 === 1, producing atob exceptions that the catch swallowed).
    let jwtNonceClaim: string | null = null;
    let jwtAudience: string | null = null;
    let jwtSub: string | null = null;
    let decodeError: string | null = null;
    try {
      const segments = identityToken.split(".");
      if (segments.length !== 3) {
        decodeError = `JWT has ${segments.length} segments, expected 3`;
      } else {
        const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
        const padLen = (4 - (base64.length % 4)) % 4;
        const padded = base64 + "=".repeat(padLen);
        const json = atob(padded);
        const decoded = JSON.parse(json);
        jwtNonceClaim = (decoded?.nonce as string | undefined) ?? null;
        jwtAudience = (decoded?.aud as string | undefined) ?? null;
        jwtSub = (decoded?.sub as string | undefined) ?? null;
      }
    } catch (err) {
      decodeError = errorMessage(err);
    }

    const jwtNonceMatchesHashed = jwtNonceClaim === hashedNonce;
    const sha256OfHashed = await sha256Hex(hashedNonce);
    const jwtNonceMatchesDoubleHashed = jwtNonceClaim === sha256OfHashed;

    pushIosDebugLog("AppleAuth", "Apple returned identityToken — exchanging with Supabase", {
      hasEmail: Boolean(response.response.email),
      hasGivenName: Boolean(response.response.givenName),
      identityTokenLength: identityToken.length,
      decodeError,
      jwtNonceClaim,
      jwtAudience,
      jwtSub: jwtSub ? jwtSub.slice(0, 24) + "…" : null,
      ourHashedNoncePreview: hashedNonce.slice(0, 16) + "…",
      // The "true" outcome here tells us the protocol:
      jwtNonceMatchesHashed,           // → Apple stored our hashedNonce verbatim (Apple does NOT hash)
      jwtNonceMatchesDoubleHashed,     // → Apple DID hash our hashedNonce (so we should have sent raw)
    });

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: identityToken,
      // Supabase hashes this raw nonce and compares to JWT.nonce. We send
      // the RAW nonce (not the hashed one).
      nonce: rawNonce,
    });

    if (error) {
      pushIosDebugLog("AppleAuth", "Supabase signInWithIdToken failed", {
        message: error.message,
        status: (error as { status?: number }).status,
      });
      return { error: new Error(error.message) };
    }

    const provider = data.user?.app_metadata?.provider;
    const providers = Array.isArray(data.user?.app_metadata?.providers)
      ? (data.user?.app_metadata?.providers as string[])
      : [];
    const isAppleUser = provider === "apple" || providers.includes("apple");
    const identities = Array.isArray(data.user?.identities)
      ? data.user.identities
      : [];
    const hasNonAppleIdentity = identities.some(
      (identity) => identity.provider && identity.provider !== "apple",
    );

    if (isAppleUser && !hasNonAppleIdentity) {
      markAppleAuthStarted();
    }

    updateOauthDebug({ sessionApplied: true });
    pushIosDebugLog("AppleAuth", "Apple sign-in completed", {
      userId: data.user?.id,
      isAppleUser,
    });

    return {};
  } catch (err) {
    pushIosDebugLog("AppleAuth", "Apple sign-in threw", {
      message: errorMessage(err),
    });
    updateOauthDebug({ error: errorMessage(err) });
    return { error: getFriendlyAppleError(err) };
  }
}

// ────────────────────────────────────────────────────────────────────
// Public API — preserves signatures used by existing callers
// (AppleSignInButton, Auth.tsx, AppleAuthLaunch, OAuthCallback).
// ────────────────────────────────────────────────────────────────────

export async function nativeAppleSignIn(options?: {
  hideEmail?: boolean;
}): Promise<{ error?: Error }> {
  return performAppleSignIn(options);
}

/**
 * Legacy: was used by /apple-auth-launch route to bounce iOS off a published
 * web page (to satisfy Apple's "redirect_uri must be an https domain" rule
 * for managed OAuth). With the native ASAuthorizationController flow, no
 * redirect is needed — call straight through.
 */
export async function startPublishedAppleSignIn(): Promise<{ error?: Error }> {
  return performAppleSignIn();
}

/**
 * Legacy no-op kept for OAuthCallback.tsx compatibility. The native flow
 * doesn't need a persisted attempt id because Apple's JWT contains the
 * nonce — no separate state machine to clean up.
 */
export function clearPublishedAppleAttempt() {
  /* intentionally empty */
}
