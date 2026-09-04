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
  /** User marked themselves sick on TODAY's check-in (habits.sick_day). */
  sickToday: boolean;
  /** Sick-marked days in the window. */
  sickDays: number;
  /** Consecutive days trained (workout=true), counting back from the most
   *  recent logged day — the overtraining signal. */
  consecutiveTrainingDays: number;
  /** Second sessions (extra_workout) in the last 7 days. */
  secondSessions7d: number;
  /** Food diary (meal_logs) — null when no meal was logged in the last 7 days. */
  diary: DiaryToday | null;
}

/** Today's food diary + a 7-day usage pulse. Every number is a self-logged
 *  ESTIMATE (photo portions ±30%) — the block tells the model so. */
export interface DiaryToday {
  mealsToday: number;
  proteinG: number;
  kcal: number;
  targetProteinG: number | null;
  targetKcal: number | null;
  mealsLogged7d: number;
  daysLogged7d: number;
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
    const todayStr = new Date().toISOString().slice(0, 10);
    const weekAgoStr = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const [checkinsRes, profileRes, mealsRes, targetRes] = await Promise.all([
      client
        .from("daily_checkins")
        .select(CHECKIN_COLUMNS)
        .eq("user_id", userId)
        .gte("checked_in_at", since)
        .order("checked_in_at", { ascending: true }),
      client.from("profiles").select("checkin_habits").eq("user_id", userId).maybeSingle(),
      // Food diary: 7 days of meals + the targets row in force today. Each
      // read swallows its own failure (table not migrated yet, network) so
      // the diary degrades to null instead of taking the whole block down.
      Promise.resolve(
        client.from("meal_logs").select("log_date, kcal, protein_g").eq("user_id", userId).gte("log_date", weekAgoStr),
      ).catch(() => ({ data: null })),
      Promise.resolve(
        client.from("nutrition_targets").select("kcal, protein_g, effective_from").eq("user_id", userId)
          .lte("effective_from", todayStr).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
      ).catch(() => ({ data: null })),
    ]);
    const rows: Record<string, unknown>[] = checkinsRes.data ?? [];
    const chosen = resolveChosen(profileRes.data?.checkin_habits ?? null);

    const isSickRow = (r: Record<string, unknown>) =>
      Boolean((r.habits as Record<string, unknown> | null)?.sick_day);
    // Sick days don't count against habit rates — being ill is not neglect.
    const wellRows = rows.filter((r) => !isSickRow(r));

    const todayRow =
      rows.find((r) => String(r.checked_in_at ?? "").slice(0, 10) === todayStr) ?? null;

    const rates: HabitRate[] = chosen.map((h) => ({
      key: h.key,
      label: h.label,
      pillar: h.pillar,
      doneDays: wellRows.filter((r) => habitDoneOnRow(r, h.key)).length,
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

    // Overtraining signals: consecutive trained days back from the latest
    // logged day, and second sessions over the last 7 days.
    let consecutiveTrainingDays = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].workout === true) consecutiveTrainingDays++;
      else break;
    }
    const week = rows.filter(
      (r) => Date.now() - new Date(String(r.checked_in_at)).getTime() < 7 * 86_400_000,
    );
    const secondSessions7d = week.filter((r) => habitDoneOnRow(r, "extra_workout")).length;

    // Food diary — meal rows carry trigger-derived kcal/protein_g; never re-derived here.
    type MealRow = { log_date: string; kcal: number | null; protein_g: number | null };
    const meals: MealRow[] = mealsRes?.data ?? [];
    const target = (targetRes?.data ?? null) as { kcal: number | null; protein_g: number | null } | null;
    const todayMeals = meals.filter((m) => String(m.log_date) === todayStr);
    const sumToday = (k: "kcal" | "protein_g") =>
      Math.round(todayMeals.reduce((s, m) => s + Number(m[k] ?? 0), 0));
    const diary: DiaryToday | null = meals.length === 0 ? null : {
      mealsToday: todayMeals.length,
      proteinG: sumToday("protein_g"),
      kcal: sumToday("kcal"),
      targetProteinG: target?.protein_g != null ? Number(target.protein_g) : null,
      targetKcal: target?.kcal != null ? Number(target.kcal) : null,
      mealsLogged7d: meals.length,
      daysLogged7d: new Set(meals.map((m) => String(m.log_date))).size,
    };

    return {
      windowDays: days,
      checkinDays: wellRows.length,
      // A perfect day = every DAILY habit done; bonus extras never required.
      perfectDays: wellRows.filter((r) => dailyChosen.every((h) => habitDoneOnRow(r, h.key))).length,
      rates,
      doneToday: daily.filter((r) => r.doneToday === true).map((r) => r.label),
      missedToday: todayRow ? daily.filter((r) => r.doneToday === false).map((r) => r.label) : [],
      bonusHabits: bonus.map((r) => (r.doneToday === true ? `${r.label} ✓ today` : r.label)),
      unchosen,
      sickToday: todayRow ? isSickRow(todayRow) : false,
      sickDays: rows.filter(isSickRow).length,
      consecutiveTrainingDays,
      secondSessions7d,
      diary,
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
  if (g.sickToday) {
    lines.push("- ⚠️ The user marked themselves SICK today.");
  } else if (g.sickDays > 0) {
    lines.push(`- Was sick on ${g.sickDays} day${g.sickDays === 1 ? "" : "s"} in this window (those days are excluded from the rates).`);
  }
  if (g.consecutiveTrainingDays >= 6 || g.secondSessions7d >= 3) {
    lines.push(`- 🔺 OVERTRAINING SIGNAL: ${g.consecutiveTrainingDays} consecutive training days` +
      (g.secondSessions7d >= 3 ? ` and ${g.secondSessions7d} double sessions in 7 days` : "") + ".");
  }
  if (g.doneToday.length || g.missedToday.length) {
    if (g.doneToday.length) lines.push(`- Done TODAY: ${g.doneToday.join(", ")}.`);
    if (g.missedToday.length) lines.push(`- Missed today: ${g.missedToday.join(", ")}.`);
  }
  if (g.diary) {
    const d = g.diary;
    const protein = d.targetProteinG != null
      ? `protein ${d.proteinG} g / ${d.targetProteinG} g target`
      : `protein ${d.proteinG} g (no target set)`;
    const kcal = d.targetKcal != null ? `${d.kcal} / ${d.targetKcal} kcal` : `${d.kcal} kcal`;
    lines.push(`- Food diary TODAY: ${d.mealsToday} meal${d.mealsToday === 1 ? "" : "s"} logged · ${protein} · ${kcal}. (${d.daysLogged7d}/7 days logged this week.) These are self-logged ESTIMATES (photo portions ±30%) — never quote them as exact.`);
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

Rules for using it: NEVER tell them to improve a habit that is already done today or already solid — that reads as not paying attention. Anchor improvement advice in the habitually neglected DAILY habits (pick ONE, the most impactful). Bonus habits (e.g. a second training session) are optional extras: celebrate them when done, never call them a gap, "falling behind" or something to fix. If everything daily is solid, inspire ONE new habit from the candidates instead — sell why it compounds with what they already do. SICK DAY RULE: when the user is sick, NEVER push training, cold exposure or intensity, and never frame missed habits as failure — praise them for logging while ill and give recovery-promoting guidance only (rest, fluids, extra sleep, gentle walk at most; see a doctor if it drags on). OVERTRAINING RULE: when the overtraining signal fires, proactively recommend a REST day and explain that adaptation happens in recovery — do not program more volume or intensity, even if they ask for it lightly. DIARY RULE: when the food diary shows protein under target late in the day, that is the ONE nutrition lever — name roughly how many grams are left and one food that closes it. Never nag about logging meals more than once, and never present diary numbers as exact.`;
}
