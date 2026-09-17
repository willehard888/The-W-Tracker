import { describe, expect, it, vi, beforeEach } from "vitest";

const auth = vi.hoisted(() => ({ getSession: vi.fn(), setSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
import { applySessionFromUrl, tokenSubject } from "@/lib/oauth-session";

const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const token = (sub: string) => `h.${b64url({ sub })}.s`;
const link = (sub: string) => `https://whealthfactory.com/reset-password#access_token=${token(sub)}&refresh_token=r`;

describe("oauth-session", () => {
  beforeEach(() => { vi.clearAllMocks(); auth.setSession.mockResolvedValue({ error: null }); });

  it("reads the subject of a token and survives rubbish", () => {
    expect(tokenSubject(token("u1"))).toBe("u1");
    expect(tokenSubject("not-a-token")).toBeNull();
  });

  it("refuses a link that would replace a signed-in member with another account", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "victim" } } } });
    expect(await applySessionFromUrl(link("attacker"))).toBe(false);
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it("applies a link for the same member, and for nobody signed in", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "me" } } } });
    expect(await applySessionFromUrl(link("me"))).toBe(true);
    auth.getSession.mockResolvedValue({ data: { session: null } });
    expect(await applySessionFromUrl(link("anyone"))).toBe(true);
    expect(auth.setSession).toHaveBeenCalledTimes(2);
  });
});
