/**
 * Helpers for computing a tribe's *collective* streak — the sum of every
 * active member's current streak. Used to drive the cinematic flame on
 * tribe headers and list rows.
 */

import { supabase } from "@/integrations/supabase/client";
import { personalStreakTier } from "@/lib/streak";

/** Map a collective streak total to the 0–6 tier ladder. Tier 6 = Firestorm (plasma ceiling). */
export const collectiveStreakTier = (total: number): number => {
  if (total >= 6000) return 6; // Firestorm
  if (total >= 3000) return 5; // Legendary
  if (total >= 1500) return 4; // Diamond
  if (total >= 700)  return 3; // Blazing
  if (total >= 300)  return 2; // On fire
  if (total >= 100)  return 1; // Warm
  if (total >= 30)   return 0; // Hot
  return -1; // Cold (no flame)
};

/** Display name for a tier index (-1..6). The one true name ladder. */
export const tierName = (t: number): string =>
  t === 6 ? "Firestorm" :
  t === 5 ? "Legendary" :
  t === 4 ? "Diamond"   :
  t === 3 ? "Blazing"   :
  t === 2 ? "On Fire"   :
  t === 1 ? "Warm"      :
  t === 0 ? "Hot"       : "Cold";

export const collectiveTierName = (total: number): string =>
  tierName(collectiveStreakTier(total));

/** Accent color for the collective flame at each tier. */
export const collectiveAccent = (total: number): string => {
  const t = collectiveStreakTier(total);
  if (t === 6) return "hsl(195 90% 60%)"; // Firestorm — cyan plasma core
  if (t === 5) return "hsl(300 75% 60%)";
  if (t === 4) return "hsl(190 90% 60%)";
  if (t === 3) return "hsl(28 95% 55%)";
  if (t === 2) return "hsl(16 92% 55%)";
  if (t === 1) return "hsl(20 92% 56%)";
  if (t === 0) return "hsl(14 90% 56%)";
  return "hsl(var(--muted-foreground))";
};

/** Whether this collective flame is at the Firestorm (plasma) tier. */
export const isFirestorm = (total: number) => collectiveStreakTier(total) >= 6;

// ── Flame palettes ────────────────────────────────────────────────────────────
// Full per-tier color tables for the TribeFireLite engine. Lifted from
// StreakFlameInline (the app's reference flame) so tribe fire and header fire
// share one visual language. `base` is the dark gradient root at the flame's
// bottom — without it every tier bottomed out in the same hardcoded red and
// the cyan/magenta top tiers never read as different fires.

export interface FlamePalette {
  /** Dark root at the flame base (bottom gradient stop). */
  base: string;
  /** Outer body color. */
  outer: string;
  /** Mid body color. */
  mid: string;
  /** Hottest visible color (tip / inner core). */
  core: string;
  /** Light-emission color (halo, ground cast, box-shadow bloom). */
  glow: string;
  /** Matching text/label color. */
  text: string;
}

const COLD_PALETTE: FlamePalette = {
  base:  "hsl(var(--muted-foreground))",
  outer: "hsl(var(--muted-foreground))",
  mid:   "hsl(var(--muted-foreground))",
  core:  "hsl(var(--muted-foreground))",
  glow:  "transparent",
  text:  "hsl(var(--muted-foreground))",
};

/** Indexed by tier 0..6. Cold (-1) falls back to COLD_PALETTE. */
const TIER_PALETTES: FlamePalette[] = [
  // 0 Hot
  { base: "hsl(8 78% 34%)",   outer: "hsl(15 92% 57%)",  mid: "hsl(22 94% 58%)",  core: "hsl(44 100% 75%)",  glow: "hsl(14 90% 56%)",  text: "hsl(14 90% 62%)" },
  // 1 Warm
  { base: "hsl(10 80% 36%)",  outer: "hsl(16 90% 52%)",  mid: "hsl(24 94% 58%)",  core: "hsl(45 100% 78%)",  glow: "hsl(var(--ember))",  text: "hsl(18 95% 62%)" },
  // 2 On Fire
  { base: "hsl(8 82% 38%)",   outer: "hsl(16 92% 50%)",  mid: "hsl(28 95% 58%)",  core: "hsl(48 100% 80%)",  glow: "hsl(28 95% 60%)",  text: "hsl(28 95% 65%)" },
  // 3 Blazing
  { base: "hsl(16 85% 40%)",  outer: "hsl(28 95% 52%)",  mid: "hsl(40 95% 60%)",  core: "hsl(56 100% 86%)",  glow: "hsl(42 85% 60%)",  text: "hsl(42 90% 65%)" },
  // 4 Diamond — cyan + gold
  { base: "hsl(210 70% 35%)", outer: "hsl(190 90% 60%)", mid: "hsl(40 95% 60%)",  core: "hsl(58 100% 90%)",  glow: "hsl(200 85% 65%)", text: "hsl(200 85% 70%)" },
  // 5 Legendary — magenta + gold
  { base: "hsl(285 65% 35%)", outer: "hsl(300 75% 60%)", mid: "hsl(35 100% 60%)", core: "hsl(60 100% 92%)",  glow: "hsl(280 80% 65%)", text: "hsl(280 80% 70%)" },
  // 6 Firestorm — cyan-core plasma
  { base: "hsl(255 70% 35%)", outer: "hsl(310 85% 60%)", mid: "hsl(265 80% 60%)", core: "hsl(180 100% 92%)", glow: "hsl(195 90% 65%)", text: "hsl(195 95% 72%)" },
];

/**
 * The cold-state kindling fire (hero, <30 days): a small struggling flame on
 * a coal bed — dimmer and deeper than Hot so ignition still feels like a
 * promotion, but genuinely alive.
 */
export const KINDLING_PALETTE: FlamePalette = {
  base:  "hsl(6 70% 22%)",
  outer: "hsl(10 85% 42%)",
  mid:   "hsl(20 90% 50%)",
  core:  "hsl(38 100% 66%)",
  glow:  "hsl(16 90% 45%)",
  text:  "hsl(24 80% 62%)",
};

/** Palette for a tier index (-1..6). */
export const tierPalette = (tier: number): FlamePalette =>
  tier >= 0 && tier <= 6 ? TIER_PALETTES[tier] : COLD_PALETTE;

/** Palette for a tribe's collective streak total. */
export const collectivePalette = (total: number): FlamePalette =>
  tierPalette(collectiveStreakTier(total));

/**
 * Per-tier flicker speed in seconds (lower = livelier). Same ladder as
 * StreakFlameInline so a Firestorm tribe burns with header-flame urgency.
 */
export const tierFlameSpeed = (tier: number): number =>
  tier >= 6 ? 0.7 :
  tier === 5 ? 0.85 :
  tier === 4 ? 1.0 :
  tier === 3 ? 1.15 :
  tier === 2 ? 1.3 :
  tier === 1 ? 1.55 : 1.85;

/**
 * Palette for an individual member's streak — uses the PERSONAL ladder
 * (3/7/14/30/60/100/200, `personalStreakTier` from lib/streak) so member
 * flames (MemberContributionStrip) get all 7 states instead of being
 * flattened by the collective thresholds (30..6000).
 */
export const personalPalette = (streak: number): FlamePalette =>
  tierPalette(personalStreakTier(streak));

/**
 * Append an alpha channel to an hsl() color string. Handles both literal
 * (`hsl(14 90% 56%)`) and token (`hsl(var(--muted-foreground))`) forms —
 * replaces the fragile `accent.replace(/(\d+)%\)/...)` surgery scattered
 * through the tribe components, which silently broke on the token form.
 */
export const withAlpha = (color: string, alpha: number): string => {
  if (!color.startsWith("hsl(") || !color.endsWith(")")) return color;
  return `${color.slice(0, -1)} / ${alpha})`;
};

/**
 * Resolve CSS custom-property tokens inside a color string to their computed
 * values — canvas fillStyle can't evaluate `hsl(var(--ember))`. Reads from
 * :root at call time; safe to call once per palette build (not per frame).
 */
export const resolveCssColor = (color: string): string =>
  color.replace(/var\((--[\w-]+)\)/g, (_, name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
  );

/**
 * Collective streak for a single tribe — server-owned since the tribe-fire
 * migration (tribes.collective_streak, refreshed nightly by
 * refresh_tribe_fire). One read instead of two member/profile scans; the
 * realtime reactor layers live deltas on top of this seed.
 */
export const fetchTribeCollectiveStreak = async (tribeId: string): Promise<number> => {
  const { data, error } = await supabase
    .from("tribes")
    .select("collective_streak")
    .eq("id", tribeId)
    .maybeSingle();
  if (error) console.warn("tribe-streak:", error.message);
  return data?.collective_streak ?? 0;
};

/**
 * Batch version for the tribe list — returns a Map<tribeId, totalStreak>.
 * (fetchUserTotalTribeHeat was removed with the list-page fire hero.)
 */
export const fetchTribeCollectiveStreaks = async (
  tribeIds: string[],
): Promise<Map<string, number>> => {
  const out = new Map<string, number>();
  if (tribeIds.length === 0) return out;
  tribeIds.forEach((id) => out.set(id, 0));
  const { data, error } = await supabase
    .from("tribes")
    .select("id, collective_streak")
    .in("id", tribeIds);
  if (error) console.warn("tribe-streak batch:", error.message);
  (data ?? []).forEach((t) => {
    out.set(t.id, t.collective_streak ?? 0);
  });
  return out;
};
