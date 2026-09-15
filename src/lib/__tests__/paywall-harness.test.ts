import { describe, expect, it } from "vitest";
import { readHarnessParam, shouldForcePaywall } from "@/lib/paywall-harness";

describe("paywall harness", () => {
  it("parses on / off / absent", () => {
    expect(readHarnessParam("?paywallDev=1")).toBe("on");
    expect(readHarnessParam("?paywallDev=0")).toBe("off");
    expect(readHarnessParam("?x=1")).toBeNull();
  });

  it("is dead for a plain member in a release build, live for dev and for admins", () => {
    expect(shouldForcePaywall({ dev: false, isAdmin: false, param: "on", sticky: true })).toBe(false);
    expect(shouldForcePaywall({ dev: true, isAdmin: false, param: "on", sticky: false })).toBe(true);
    expect(shouldForcePaywall({ dev: false, isAdmin: true, param: null, sticky: true })).toBe(true);
    expect(shouldForcePaywall({ dev: false, isAdmin: true, param: "off", sticky: true })).toBe(false);
    expect(shouldForcePaywall({ dev: false, isAdmin: true, param: null, sticky: false })).toBe(false);
  });
});
