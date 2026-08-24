/**
 * Referral engine v2 — one source of truth for the reward math.
 *
 * The deal (founder decision 2026-08-24):
 *   · Friend joins with your code       → you get +50 XP (claim_referral)
 *   · Friend logs their 3rd check-in    → you get +250 XP ("activated")
 *   · Every 3 PAID friends              → you get +30 days of free membership,
 *                                          forever, no cap. 3 → 1 mo, 6 → 2 mo …
 * Status is never a reward — Apex/Legend grants were removed from the engine
 * (already-granted ones stay; see referral_engine_v2 migration).
 *
 * Mirrored in SQL (reward_referral_conversion v3) and in the edge functions
 * (notify-referral, revenuecat-webhook, stripe-webhook) — Deno can't import
 * this file, so keep the constants in sync when they change.
 */

/** Paid conversions needed per free month. */
export const CREDIT_EVERY = 3;
/** Days of membership credit granted per CREDIT_EVERY paid friends. */
export const CREDIT_DAYS = 30;
/** Friend check-ins that count as "activated". */
export const ACTIVATION_CHECKINS = 3;
/** Referrer XP when a recruit activates. */
export const ACTIVATION_XP = 250;
/** Referrer XP the moment a recruit joins with the code. */
export const JOIN_XP = 50;

/** Whole free months already earned from paid conversions. */
export const freeMonthsEarned = (paidCount: number): number =>
  Math.floor(Math.max(0, paidCount) / CREDIT_EVERY);

/** How many more paid friends until the NEXT free month (1..CREDIT_EVERY). */
export const paidToNextMonth = (paidCount: number): number =>
  CREDIT_EVERY - (Math.max(0, paidCount) % CREDIT_EVERY);

/** The paid-count at which the next free month lands. */
export const nextMonthAt = (paidCount: number): number =>
  Math.max(0, paidCount) + paidToNextMonth(paidCount);

/** Progress toward the next free month, 0..1 (for the ring). */
export const nextMonthProgress = (paidCount: number): number =>
  (Math.max(0, paidCount) % CREDIT_EVERY) / CREDIT_EVERY;

/** Badge-only milestones (XP/badges — never credits or status). */
export const BADGE_MILESTONES = [
  { count: 1, title: "First Recruit", detail: "+250 XP · First Recruit badge", emoji: "🎯" },
  { count: 5, title: "Brand Ambassador", detail: "Brand Ambassador badge", emoji: "🌟" },
  { count: 10, title: "Inner Circle", detail: "Inner Circle Founder badge", emoji: "⚡" },
  { count: 25, title: "Kingmaker", detail: "Kingmaker badge", emoji: "🏆" },
  { count: 50, title: "Founders Circle", detail: "Founders Circle badge", emoji: "🔱" },
] as const;
