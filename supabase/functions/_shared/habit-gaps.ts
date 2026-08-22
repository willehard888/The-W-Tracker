// Habit gaps — the coach's per-habit truth.
//
// Founder feedback that forced this: after a check-in where protein and water
// were already optimal, the coach said "tighten the basics: protein and
// water" — because no coach surface saw WHICH habits were done or habitually
// skipped. This builder gives every coach function the same three facts:
//   1. today's per-habit result (when a row for today exists)
//   2. each chosen habit's completion rate over the window
//   3. catalog habits the user has NOT chosen (new-habit inspiration)
//
// Same gather/build convention as _shared/situation.ts.

// deno-lint-ignore-file no-explicit-any
import {
  SHARED_HABIT_BY_KEY,
  SHARED_CHECKIN_HABITS,
  resolveChosen,
  habitDoneOnRow,
} from "./checkin-habits.ts";

export interface HabitRate {
  key: string;
  label: string;
  pillar: string;
  doneDays: number;
  windowDays: number;
  doneToday: boolean | null; // null = no row for today
  /** Occasional extra — excluded from missed/neglected/perfect-day math. */
  bonus: boolean;
}

export interface HabitGaps {
  windowDays: number;
  checkinDays: number;
  /** Days in the window where EVERY chosen habit was done (the honest
   *  "perfect day" — scored against THEIR set, not the legacy default). */
  perfectDays: number;
  rates: HabitRate[];
  /** Chosen DAILY habits completed today (labels). */
  doneToday: string[];
  /** Chosen DAILY habits missed today (labels) — bonus habits never appear here. */
  missedToday: string[];
  /** Bonus habits in their set (labels) — "✓" when done today. */
  bonusHabits: string[];
  /** Catalog habits NOT in the user's set — new-habit candidates (labels). */
  unchosen: string[];
}

const CHECKIN_COLUMNS =
  "checked_in_at, sleep_hours, hydration_liters, workout, meditation_morning, meditation_evening, extra_workout, cold_shower, healthy_food, protein_intake, reading, no_phone_morning, no_phone_evening, habits";

/**
 * One query + one profiles read. `client` may be user-scoped (RLS) or
 * service-role. Failures return null — coach context degrades, never breaks.
 */
export async function gatherHabitGaps(
  client: any,
  userId: string,
  opts: { days?: number } = {},
): Promise<HabitGaps | null> {
  const days = opts.days ?? 14;
  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const [checkinsRes, profileRes] = await Promise.all([
      client
        .from("daily_checkins")
        .select(CHECKIN_COLUMNS)
        .eq("user_id", userId)
        .gte("checked_in_at", since)
        .order("checked_in_at", { ascending: true }),
      client.from("profiles").select("checkin_habits").eq("user_id", userId).maybeSingle(),
    ]);
    const rows: Record<string, unknown>[] = checkinsRes.data ?? [];
    const chosen = resolveChosen(profileRes.data?.checkin_habits ?? null);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayRow =
      rows.find((r) => String(r.checked_in_at ?? "").slice(0, 10) === todayStr) ?? null;

    const rates: HabitRate[] = chosen.map((h) => ({
      key: h.key,
      label: h.label,
      pillar: h.pillar,
      doneDays: rows.filter((r) => habitDoneOnRow(r, h.key)).length,
      windowDays: days,
      doneToday: todayRow ? habitDoneOnRow(todayRow, h.key) : null,
      bonus: h.cadence === "bonus",
    }));
    const daily = rates.filter((r) => !r.bonus);
    const bonus = rates.filter((r) => r.bonus);

    const chosenKeys = new Set(chosen.map((h) => h.key));
    // A few unchosen candidates, spread across pillars so the suggestion pool
    // isn't five variations of the same theme.
    const unchosen: string[] = [];
    const pillarsSeen = new Set<string>();
    for (const h of SHARED_CHECKIN_HABITS) {
      if (chosenKeys.has(h.key)) continue;
      if (pillarsSeen.has(h.pillar) && unchosen.length >= 3) continue;
      unchosen.push(h.label);
      pillarsSeen.add(h.pillar);
      if (unchosen.length >= 5) break;
    }

    const dailyChosen = chosen.filter((h) => h.cadence !== "bonus");
    return {
      windowDays: days,
      checkinDays: rows.length,
      // A perfect day = every DAILY habit done; bonus extras never required.
      perfectDays: rows.filter((r) => dailyChosen.every((h) => habitDoneOnRow(r, h.key))).length,
      rates,
      doneToday: daily.filter((r) => r.doneToday === true).map((r) => r.label),
      missedToday: todayRow ? daily.filter((r) => r.doneToday === false).map((r) => r.label) : [],
      bonusHabits: bonus.map((r) => (r.doneToday === true ? `${r.label} ✓ today` : r.label)),
      unchosen,
    };
  } catch (e) {
    console.error("gatherHabitGaps failed:", e);
    return null;
  }
}

/**
 * Render the block. Empty string when there's nothing useful, so callers can
 * append unconditionally (situation.ts convention).
 */
export function buildHabitGapsBlock(g: HabitGaps | null): string {
  if (!g || g.rates.length === 0) return "";

  const lines: string[] = [];
  if (g.doneToday.length || g.missedToday.length) {
    if (g.doneToday.length) lines.push(`- Done TODAY: ${g.doneToday.join(", ")}.`);
    if (g.missedToday.length) lines.push(`- Missed today: ${g.missedToday.join(", ")}.`);
  }

  if (g.checkinDays > 0) {
    // Bonus habits are excluded from neglect/solid math — they're extras.
    const sorted = [...g.rates].filter((r) => !r.bonus).sort((a, b) => a.doneDays - b.doneDays);
    const neglected = sorted.filter((r) => r.doneDays / Math.max(1, g.checkinDays) < 0.3);
    const solid = sorted.filter((r) => r.doneDays / Math.max(1, g.checkinDays) >= 0.7);
    if (neglected.length) {
      lines.push(
        `- Habitually NEGLECTED (last ${g.checkinDays} logged days): ${neglected
          .map((r) => `${r.label} ${r.doneDays}/${g.checkinDays}`)
          .join(", ")}.`,
      );
    }
    if (solid.length) {
      lines.push(`- Already SOLID (≥70%): ${solid.map((r) => r.label).join(", ")}.`);
    }
  }
  if (g.checkinDays > 0 && g.perfectDays > 0) {
    lines.push(`- Perfect days (every daily habit done): ${g.perfectDays}/${g.checkinDays}.`);
  }
  if (g.bonusHabits.length) {
    lines.push(`- Occasional BONUS habits (never expected daily — praise when done, never push): ${g.bonusHabits.join(", ")}.`);
  }
  if (g.unchosen.length) {
    lines.push(`- Not in their habit set yet (new-habit candidates): ${g.unchosen.join(", ")}.`);
  }

  if (!lines.length) return "";

  return `Their per-habit truth (use this to AIM advice — never recite the list):
${lines.join("\n")}

Rules for using it: NEVER tell them to improve a habit that is already done today or already solid — that reads as not paying attention. Anchor improvement advice in the habitually neglected DAILY habits (pick ONE, the most impactful). Bonus habits (e.g. a second training session) are optional extras: celebrate them when done, never call them a gap, "falling behind" or something to fix. If everything daily is solid, inspire ONE new habit from the candidates instead — sell why it compounds with what they already do.`;
}
