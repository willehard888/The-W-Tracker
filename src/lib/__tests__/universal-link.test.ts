import { describe, expect, it } from "vitest";
import { WEB_ORIGIN, authRedirectOrigin, universalLinkRoute } from "@/lib/universal-link";

describe("universalLinkRoute", () => {
  it("routes the three claimed paths, on www and on the apex", () => {
    expect(universalLinkRoute(`${WEB_ORIGIN}/u/mogger888`)).toBe("/u/mogger888");
    expect(universalLinkRoute("https://whealthfactory.com/tribes/abc-123")).toBe("/tribes/abc-123");
    expect(universalLinkRoute(`${WEB_ORIGIN}/reset-password`)).toBe("/reset-password");
  });

  it("keeps a recovery link's tokens for the page that applies them", () => {
    expect(universalLinkRoute(`${WEB_ORIGIN}/reset-password#access_token=a&type=recovery`)).toBe("/reset-password#access_token=a&type=recovery");
  });

  it("refuses everything else: other hosts, http, unclaimed paths, rubbish", () => {
    for (const bad of [
      "https://evil.example/u/mogger888",
      "https://www.whealthfactory.com.evil.example/u/x",
      "http://www.whealthfactory.com/u/x",
      `${WEB_ORIGIN}/admin/moderation`,
      `${WEB_ORIGIN}/u/a/b`,
      `${WEB_ORIGIN}/`,
      "app://localhost/u/x",
      "not a url",
    ]) expect(universalLinkRoute(bad), bad).toBeNull();
  });
});

describe("authRedirectOrigin", () => {
  it("is this page on the web (jsdom serves http)", () => {
    expect(authRedirectOrigin()).toBe(window.location.origin);
  });
});
