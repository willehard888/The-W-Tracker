// Causal health signals — last night's recovery vs the athlete's own baseline,
// PLUS yesterday's training/sport load and any user-confirmed factors, with a
// reasoning directive so the coach explains WHY sleep/performance changed —
// including spotting the alcohol / late-meal sleep-disruption signature.
//
// FAIL-OPEN: any error → no block; the coach just won't mention recovery.

// deno-lint-ignore no-explicit-any
type AnyClient = any;

interface NightRow {
  night_date: string;
  resting_hr: number | null;
  avg_hr: number | null;
  min_hr: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  sleep_total_min: number | null;
  sleep_deep_min: number | null;
  sleep_rem_min: number | null;
  awake_min: number | null;
  factors: string[] | null;
}

const median = (xs: number[]): number | null => {
  const a = xs.filter((v) => v != null && !Number.isNaN(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const col = (rows: NightRow[], k: keyof NightRow) =>
  rows.map((r) => r[k] as number | null).filter((v): v is number => v != null);

export interface NightSignals {
  hasData: boolean;
  last?: NightRow;
  baseline?: { restingHr: number | null; respRate: number | null; sleepMin: number | null; deepMin: number | null; remMin: number | null };
  training?: { workoutMin: number | null; activeKcal: number | null; lastRpe: number | null };
}

export async function gatherNightSignals(supabase: AnyClient, _userId: string): Promise<NightSignals> {
  try {
    const { data } = await supabase.rpc("recent_night_metrics", { p_days: 30 });
    const rows = (Array.isArray(data) ? data : []) as NightRow[];
    if (!rows.length) return { hasData: false };
    const last = rows[0];
    const prior = rows.slice(1, 15);

    // Yesterday's training load (to separate "hard session" from other causes)
    // + most recent RPE. Best-effort.
    let training: NightSignals["training"] = { workoutMin: null, activeKcal: null, lastRpe: null };
    try {
      const [{ data: snaps }, { data: refl }] = await Promise.all([
        supabase.from("health_sync_snapshots").select("snapshot_date, workout_minutes, active_kcal").order("snapshot_date", { ascending: false }).limit(3),
        supabase.from("coach_reflections").select("rpe_1to10").order("reflection_date", { ascending: false }).limit(1).maybeSingle(),
      ]);
      // The training that affects "last night" is the day before night_date.
      const nd = new Date(last.night_date);
      const yday = new Date(nd.getTime() - 86_400_000).toISOString().slice(0, 10);
      const s = (snaps ?? []).find((x: any) => x.snapshot_date === yday) ?? (snaps ?? [])[0];
      training = {
        workoutMin: s?.workout_minutes ?? null,
        activeKcal: s?.active_kcal ?? null,
        lastRpe: (refl as any)?.rpe_1to10 ?? null,
      };
    } catch { /* ignore */ }

    return {
      hasData: true,
      last,
      baseline: {
        restingHr: median(col(prior, "resting_hr")),
        respRate: median(col(prior, "respiratory_rate")),
        sleepMin: median(col(prior, "sleep_total_min")),
        deepMin: median(col(prior, "sleep_deep_min")),
        remMin: median(col(prior, "sleep_rem_min")),
      },
      training,
    };
  } catch {
    return { hasData: false };
  }
}

const hm = (min: number | null) => (min == null ? "?" : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`);

/**
 * Compact recovery block + causal directive. Returns "" with no data.
 */
export function buildCausalBlock(s: NightSignals): string {
  if (!s.hasData || !s.last) return "";
  const l = s.last;
  const b = s.baseline;

  const lines: string[] = [];
  const rhrDelta = l.resting_hr != null && b?.restingHr != null ? l.resting_hr - b.restingHr : null;
  const respDelta = l.respiratory_rate != null && b?.respRate != null ? l.respiratory_rate - b.respRate : null;

  if (l.resting_hr != null) {
    lines.push(`- Resting HR: ${l.resting_hr}bpm${rhrDelta != null ? ` (${rhrDelta >= 0 ? "+" : ""}${Math.round(rhrDelta)} vs baseline ${Math.round(b!.restingHr!)})` : ""}`);
  }
  if (l.sleep_total_min != null) {
    const d = b?.sleepMin != null ? l.sleep_total_min - b.sleepMin : null;
    lines.push(`- Sleep: ${hm(l.sleep_total_min)}${l.sleep_deep_min != null ? `, deep ${hm(l.sleep_deep_min)}` : ""}${l.sleep_rem_min != null ? `, REM ${hm(l.sleep_rem_min)}` : ""}${l.awake_min ? `, awake ${hm(l.awake_min)}` : ""}${d != null ? ` (${d >= 0 ? "+" : ""}${Math.round(d)}min vs baseline)` : ""}`);
  }
  if (l.respiratory_rate != null) {
    lines.push(`- Respiratory rate: ${l.respiratory_rate}/min${respDelta != null ? ` (${respDelta >= 0 ? "+" : ""}${respDelta.toFixed(1)} vs baseline)` : ""}`);
  }
  if (l.avg_hr != null || l.min_hr != null) lines.push(`- Overnight HR: avg ${l.avg_hr ?? "?"}, low ${l.min_hr ?? "?"}bpm`);
  if (l.spo2 != null) lines.push(`- Blood oxygen: ${l.spo2}%`);

  if (!lines.length) return "";

  // Training / sport load context — lets the coach tell a hard session apart from
  // other disruptors (both raise resting HR).
  const t = s.training;
  const hardSession = (t?.workoutMin ?? 0) >= 60 || (t?.lastRpe ?? 0) >= 8 || (t?.activeKcal ?? 0) >= 700;
  const trainLine = t && (t.workoutMin || t.activeKcal || t.lastRpe)
    ? `\nYesterday's training load: ${t.workoutMin ? `${t.workoutMin}min` : "?"}${t.activeKcal ? `, ${t.activeKcal} active kcal` : ""}${t.lastRpe ? `, last RPE ${t.lastRpe}/10` : ""}${hardSession ? " (HARD)" : ""}.`
    : "";

  // Disruption / alcohol-signature detection.
  const deepLow = l.sleep_deep_min != null && b?.deepMin != null && l.sleep_deep_min < b.deepMin * 0.7;
  const remLow = l.sleep_rem_min != null && b?.remMin != null && l.sleep_rem_min < b.remMin * 0.7;
  const awakeHigh = (l.awake_min ?? 0) >= 45;
  const rhrUp = (rhrDelta ?? 0) >= 5;
  const respUp = (respDelta ?? 0) >= 1;
  const flags: string[] = [];
  if (rhrUp) flags.push("resting HR elevated");
  if (respUp) flags.push("respiratory rate elevated");
  if (deepLow) flags.push("deep sleep suppressed");
  if (remLow) flags.push("REM suppressed");
  if (awakeHigh) flags.push("fragmented (high awake time)");
  // Classic alcohol / late-heavy-meal fingerprint, when NOT explained by a hard session.
  const alcoholSignature = rhrUp && respUp && (deepLow || remLow || awakeHigh) && !hardSession;

  const factorsLine = l.factors && l.factors.length
    ? `\nUser tagged last night: ${l.factors.join(", ")}. Use this as ground truth for the cause.`
    : "";
  const flagLine = flags.length ? `\nDisruption flags: ${flags.join(", ")}.` : "";
  const alcoholLine = alcoholSignature
    ? `\n⚠️ This matches the classic ALCOHOL / late-heavy-meal signature (elevated resting HR + respiratory rate + suppressed deep/REM, not explained by a hard workout). Raise it as the leading hypothesis and ask them to confirm ("did you drink or eat late last night?").`
    : "";

  return `LAST NIGHT'S RECOVERY (from Apple Health — reason about CAUSES, not just numbers):
${lines.join("\n")}${trainLine}${flagLine}${alcoholLine}${factorsLine}

How to use this — CAUSAL reasoning (works for gym AND sport):
- Connect the signals to a likely CAUSE vs the athlete's own baseline. Separate a HARD session (raises resting HR but usually preserves deep sleep) from a disruptor like ALCOHOL / a late heavy meal / high stress / illness / travel (raises resting HR AND respiratory rate AND fragments/suppresses deep+REM). If the athlete tagged a factor, treat it as the cause.
- For sport/performance: if recovery is suppressed and they report a slow run / heavy legs / poor session, tie it to the recovery data or yesterday's load ("resting HR +8 and only 40min deep after yesterday's hard session → under-recovery, not a fitness drop").
- When they ask "why did I sleep badly / why am I flat", answer with the specific signal(s) + the single most likely cause in 1–2 sentences citing their numbers vs baseline, then ONE corrective action. If the alcohol signature is present, name it and ask to confirm.
- Never medically diagnose. If resting HR is sharply elevated with low blood oxygen, suggest they may be getting sick and should rest — as a suggestion, not a diagnosis.`;
}
