import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * No self-reported body state leaves the device through analytics.
 *
 * `soreness` — a self-reported "good | tight | sore" typed into an optional
 * picker — rode along in recovery_started and recovery_completed for months,
 * and the same value rode in session_built as `feel`. Every analytics prop is
 * mirrored to a third party, so a body state reached one on every session.
 * Both were removed on 2026-09-25.
 *
 * What was NOT restored was a guard. analytics.ts said in writing that
 * "pilot-leakage.test.ts fails the build if it comes back" — and it does not:
 * that file tests sanitizeContext, which is the pilot's own context whitelist
 * and says nothing about these call sites. So the contract went back to
 * living in a comment, which is the exact failure the original fix was
 * written to end, pointing the other way.
 *
 * This is that guard. It reads the call sites rather than the module, because
 * the leak was never in analytics.ts — it was in what the pages handed it.
 */

const CALL_SITES = [
  "src/pages/Recovery.tsx",
  "src/components/recovery/RecoveryOffer.tsx",
  "src/pages/CoachSession.tsx",
  "src/hooks/use-focus-session.ts",
];

/** Self-reported body state. Muscle names are areas and stay allowed. */
const BANNED = ["soreness", "feel", "sleep_hours", "resting_hr", "energy", "weight_kg", "mood"];

/**
 * The props object of every `track(...)` call in a file.
 *
 * Brace-matched rather than regexed to a closing paren: these objects nest
 * (`ttv_minutes`, arrays of areas) and a lazy match would stop at the first
 * `}` and miss everything after it — passing while the leak sat two lines on.
 */
const trackProps = (src: string): string[] => {
  const out: string[] = [];
  const re = /\btrack\(\s*FUNNEL\.\w+\s*,\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") depth -= 1;
      i += 1;
    }
    out.push(src.slice(m.index, i));
  }
  return out;
};

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("what the recovery and session funnels carry", () => {
  it("finds the call sites it claims to be guarding", () => {
    // A walker that reads nothing passes everything.
    const found = CALL_SITES.flatMap((p) => trackProps(read(p)));
    expect(found.length, "no track(FUNNEL.x, {...}) calls parsed — the guard is inert").toBeGreaterThan(5);
  });

  it("never sends a self-reported body state", () => {
    for (const path of CALL_SITES) {
      for (const call of trackProps(read(path))) {
        for (const word of BANNED) {
          // Key position only: `areas` may legitimately hold muscle names, and
          // a comment mentioning soreness is not a leak.
          const asKey = new RegExp(`(^|[{,\\s])${word}\\s*[,:}]`);
          expect(
            asKey.test(call),
            `${path} sends "${word}" to analytics — it shapes the session on the device and must not leave it:\n${call}`,
          ).toBe(false);
        }
      }
    }
  });

  it("still sends the things that are not body state", () => {
    // The point is not to empty these events. Proves the matcher is specific.
    const recovery = trackProps(read("src/pages/Recovery.tsx")).join("\n");
    expect(recovery, "areas are muscle names, and they stay").toContain("areas");
    expect(recovery, "and how long the session was").toContain("length");
  });
});
