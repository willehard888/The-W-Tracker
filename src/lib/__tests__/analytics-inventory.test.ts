import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

/**
 * Every declared event has an emitter, and every emitter is declared.
 *
 * Both halves of this have already gone wrong in production. `payment_failed`
 * and `reminder_sent` sat in FUNNEL for years with nothing firing them, and the
 * admin page rendered a permanent zero for one of them — a dashboard that lies
 * quietly is worse than one that is missing. In the other direction,
 * `referral_activated`, `social_push_sent` and `nutrition_scan_reviewed` are
 * fired as bare strings and are in no inventory, so nothing that reads FUNNEL
 * can find them.
 *
 * Reads the tree with node:fs only. The four suites that fail on Windows all
 * import a `scripts/*.mjs` that Vite cannot transform here, and the path
 * comparison below uses basename() rather than a path suffix for the same reason.
 */

const ROOT = resolve(__dirname, "../../..");
const SKIP = new Set(["node_modules", "dist", ".git", "ios", "android", "__tests__"]);

const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
};

const sources = [join(ROOT, "src"), join(ROOT, "supabase", "functions")]
  .flatMap((d) => walk(d))
  // The declaration itself is not a use of what it declares.
  .filter((f) => basename(f) !== "analytics.ts")
  .map((f) => readFileSync(f, "utf8"));

const corpus = sources.join("\n");

const FUNNEL_SRC = readFileSync(join(ROOT, "src", "lib", "analytics.ts"), "utf8");
const entries = [...FUNNEL_SRC.matchAll(/^ {2}([a-zA-Z]+): "([a-z_]+)",/gm)].map(([, key, event]) => ({ key, event }));

/**
 * Fired by an edge function or a cron job, which write the row directly and
 * never import FUNNEL. Each one is named here so that "nothing references it"
 * is a decision somebody wrote down, not an accident nobody noticed.
 */
const SERVER_FIRED = new Set([
  "trial_started", "trial_expired", "purchase_completed", "subscription_cancelled",
  "referral_joined", "referral_converted", "winback_sent", "nudge_sent", "push_sent",
]);

describe("the event inventory is the whole inventory", () => {
  it("found the declaration and the tree", () => {
    // A walker that reads nothing passes every assertion below.
    expect(entries.length).toBeGreaterThan(50);
    expect(sources.length).toBeGreaterThan(200);
  });

  it("has an emitter for every declared event", () => {
    const orphans = entries
      .filter(({ key, event }) => !corpus.includes(`FUNNEL.${key}`) && !SERVER_FIRED.has(event) && !corpus.includes(`"${event}"`))
      .map(({ key, event }) => `${key} (${event})`);
    expect(orphans, "declared in FUNNEL but nothing fires it — this is how a dashboard grows a permanent zero").toEqual([]);
  });

  it("declares the events the pilot depends on, and fires them", () => {
    // Named one by one rather than counted: the pilot's questions about
    // training and the coach are unanswerable without exactly these.
    for (const key of [
      "workoutStarted", "workoutCompleted",
      "coachMessageSent", "coachAnswerRated",
      "reflectionSubmitted",
      "athleteProfileStep", "athleteProfileDone",
    ]) {
      expect(entries.map((e) => e.key), `${key} missing from FUNNEL`).toContain(key);
      expect(corpus.includes(`FUNNEL.${key}`), `${key} is declared but never fired`).toBe(true);
    }
  });

  it("keeps event names in the house shape", () => {
    for (const { key, event } of entries) {
      expect(event, `${key} is not lower_snake_case`).toMatch(/^[a-z][a-z0-9_]*$/);
      // analytics_event_len CHECK (char_length(event) <= 64)
      expect(event.length, `${key} would fail the table's length constraint`).toBeLessThanOrEqual(64);
    }
  });

  it("has no duplicate event names behind two keys", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const { key, event } of entries) {
      const prior = seen.get(event);
      if (prior) clashes.push(`${prior} and ${key} both fire "${event}"`);
      else seen.set(event, key);
    }
    expect(clashes).toEqual([]);
  });
});
