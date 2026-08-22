/**
 * The one model every screen teaches, in four beats:
 *   Check in daily → Streak → XP → Consistency → Top % → Tier.
 * Shared by the onboarding "daily loop" slide and the HowItWorksSheet so the
 * two can never drift apart. Pure data — icons are chosen by key in the UI.
 */
export type HowBeatKey = "checkin" | "streak" | "xp" | "ladder";

export interface HowBeat {
  key: HowBeatKey;
  title: string;
  /** One-line version for compact rows (onboarding cards). */
  short: string;
  /** Two or three sentences for the sheet. */
  body: string;
}

export const HOW_IT_WORKS_BEATS: readonly HowBeat[] = [
  {
    key: "checkin",
    title: "Check in daily",
    short: "60 seconds. Log your Core 4 — done or not.",
    body: "Every day you log the Core 4 — sleep, workout, water, meditation — honestly, done or not. Logging is the habit. It takes about a minute.",
  },
  {
    key: "streak",
    title: "Logging keeps the streak",
    short: "Miss a day, the streak resets. A shield covers one.",
    body: "Consecutive days build your streak. Miss a day and it resets — unless a streak shield covers it. The streak is about showing up, not about perfect days.",
  },
  {
    key: "xp",
    title: "What you did earns XP",
    short: "Core 4 + optional extras — one shared +40 pool.",
    body: "Each Core 4 item you did earns XP. Extras are optional and share one pool of up to +40 XP a day, however many you tick. XP only ever adds up.",
  },
  {
    key: "ladder",
    title: "Consistency climbs the ladder",
    short: "Consistency 0–100 → #N of M · Top X% → Tier.",
    body: "Your Consistency score (0–100) comes from days active, daily XP and streak. It sets your place — #N of everyone ranked, your Top % — and your tier is a band of that. Earned, never bought.",
  },
] as const;

export const howBeat = (key: HowBeatKey): HowBeat =>
  HOW_IT_WORKS_BEATS.find((b) => b.key === key) ?? HOW_IT_WORKS_BEATS[0];

/** localStorage key — the sheet auto-opens once for a user with no check-ins. */
export const howSeenKey = (userId: string) => `w_how_seen_${userId}`;
