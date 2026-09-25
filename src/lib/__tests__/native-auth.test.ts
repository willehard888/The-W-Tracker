import { describe, it, expect, vi, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

// The nonce protocol is the whole point of this module: Apple gets
// sha256(raw) and stores it verbatim in the identity token; Supabase gets
// the raw nonce, hashes it and compares. Send the wrong one to either side
// and every Sign in with Apple fails with "nonce mismatch". This pins the
// contract without a device.
const authorize = vi.fn();
const signInWithIdToken = vi.fn();

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" } }));
vi.mock("@capacitor-community/apple-sign-in", () => ({ SignInWithApple: { authorize: (...a: unknown[]) => authorize(...a) } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signInWithIdToken: (...a: unknown[]) => signInWithIdToken(...a) } } }));
vi.mock("@/lib/ios-debug", () => ({ pushIosDebugLog: () => {}, updateOauthDebug: () => {} }));
vi.mock("@/lib/universal-link", () => ({ authRedirectOrigin: () => "https://www.whealthfactory.com" }));

const sha256Hex = async (s: string) =>
  Array.from(new Uint8Array(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

// A JWT whose payload carries the nonce Apple would echo back.
const tokenWithNonce = (nonce: string) =>
  `h.${Buffer.from(JSON.stringify({ nonce, aud: "app.lovable.wtracker", sub: "000123" })).toString("base64url")}.s`;

beforeEach(() => { authorize.mockReset(); signInWithIdToken.mockReset(); });

describe("nativeAppleSignIn — the nonce contract", () => {
  it("hashes the nonce for Apple and sends the raw one to Supabase", async () => {
    authorize.mockImplementation(async (opts: { nonce: string }) => ({ response: { identityToken: tokenWithNonce(opts.nonce) } }));
    signInWithIdToken.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const { nativeAppleSignIn } = await import("@/lib/native-auth");

    const result = await nativeAppleSignIn();

    expect(result.error).toBeUndefined();
    const sentToApple = authorize.mock.calls[0][0] as { nonce: string; clientId: string; scopes: string };
    const sentToSupabase = signInWithIdToken.mock.calls[0][0] as { provider: string; token: string; nonce: string };
    expect(sentToSupabase.provider).toBe("apple");
    expect(await sha256Hex(sentToSupabase.nonce)).toBe(sentToApple.nonce);
    expect(sentToApple.nonce).not.toBe(sentToSupabase.nonce);
    expect(sentToApple.clientId).toBe("app.lovable.wtracker");
    expect(sentToApple.scopes).toBe("email name");
  });

  it("asks for the name only when the member hides their email", async () => {
    authorize.mockImplementation(async (opts: { nonce: string }) => ({ response: { identityToken: tokenWithNonce(opts.nonce) } }));
    signInWithIdToken.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const { nativeAppleSignIn } = await import("@/lib/native-auth");
    await nativeAppleSignIn({ hideEmail: true });
    expect((authorize.mock.calls[0][0] as { scopes: string }).scopes).toBe("name");
  });

  it("returns a member-facing error when Apple hands back no token", async () => {
    authorize.mockResolvedValue({ response: {} });
    const { nativeAppleSignIn } = await import("@/lib/native-auth");
    const result = await nativeAppleSignIn();
    expect(result.error?.message).toMatch(/apple sign-in failed/i);
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });
});
