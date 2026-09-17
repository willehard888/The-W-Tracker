import { describe, expect, it } from "vitest";
import { isUsernameAllowed } from "@/lib/username-rules";

describe("isUsernameAllowed", () => {
  it("lets ordinary handles through", () => {
    for (const n of ["mogger888", "rasmus", "iron_will", "apple_pie", "supportive_sam", "admin1strator_fan"]) {
      expect(isUsernameAllowed(n), n).toBe(true);
    }
  });

  it("refuses a slur anywhere, however it is dressed up", () => {
    for (const n of ["fuckface", "xXf4ggotXx", "sh1t_lord", "n_i_g_g_e_r", "FUCK99"]) {
      expect(isUsernameAllowed(n), n).toBe(false);
    }
  });

  it("refuses a handle that would pass for the team, only as the whole name", () => {
    for (const n of ["admin", "Support", "apple", "whealthfactory", "adm1n", "admin1", "a_d_m_i_n"]) {
      expect(isUsernameAllowed(n), n).toBe(false);
    }
    expect(isUsernameAllowed("applehead")).toBe(true);
  });

  it("is over-strict by design: a word inside an innocent one is still refused", () => {
    // The documented ceiling (the Scunthorpe problem). Substring matching is
    // what stops evasion, and the cost is that the odd real name has to pick
    // another handle. A server-side list with word boundaries is the upgrade.
    expect(isUsernameAllowed("scunthorpe_fc")).toBe(false);
  });
});
