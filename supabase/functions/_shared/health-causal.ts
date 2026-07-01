// Causal health signals — last night's recovery metrics vs the athlete's own
// baseline, plus a reasoning directive so the coach can explain WHY sleep or
// performance changed (not just report numbers). Pairs with progression.ts
// (training load) so the model can connect recovery ↔ performance.
//
// FAIL-OPEN: any error → no block; the coach simply won't mention recovery.

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
  baseline?: { restingHr: number | null; respRate: number | null; sleepMin: number | null };
}

export async function gatherNightSignals(supabase: AnyClient, _userId: string): Promise<NightSignals> {
  try {
    const { data } = await supabase.rpc("recent_night_metrics", { p_days: 30 });
    const rows = (Array.isArray(data) ? data : []) as NightRow[];
    if (!rows.length) return { hasData: false };
    const last = rows[0];
    const prior = rows.slice(1, 15); // up to 14 prior nights for the baseline
    return {
      hasData: true,
      last,
      baseline: {
        restingHr: median(col(prior, "resting_hr")),
        respRate: median(col(prior, "respiratory_rate")),
        sleepMin: median(col(prior, "sleep_total_min")),
      },
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
  if (l.resting_hr != null) {
    const d = b?.restingHr != null ? l.resting_hr - b.restingHr : null;
    lines.push(`- Resting HR: ${l.resting_hr}bpm${d != null ? ` (${d >= 0 ? "+" : ""}${Math.round(d)} vs 14-night baseline ${Math.round(b!.restingHr!)})` : ""}`);
  }
  if (l.sleep_total_min != null) {
    const d = b?.sleepMin != null ? l.sleep_total_min - b.sleepMin : null;
    lines.push(`- Sleep: ${hm(l.sleep_total_min)} total${l.sleep_deep_min != null ? `, deep ${hm(l.sleep_deep_min)}` : ""}${l.sleep_rem_min != null ? `, REM ${hm(l.sleep_rem_min)}` : ""}${l.awake_min ? `, awake ${hm(l.awake_min)}` : ""}${d != null ? ` (${d >= 0 ? "+" : ""}${Math.round(d)}min vs baseline)` : ""}`);
  }
  if (l.respiratory_rate != null) {
    const d = b?.respRate != null ? l.respiratory_rate - b.respRate : null;
    lines.push(`- Respiratory rate: ${l.respiratory_rate}/min${d != null ? ` (${d >= 0 ? "+" : ""}${d.toFixed(1)} vs baseline)` : ""}`);
  }
  if (l.avg_hr != null || l.min_hr != null) {
    lines.push(`- Overnight HR: avg ${l.avg_hr ?? "?"}, low ${l.min_hr ?? "?"}bpm`);
  }
  if (l.spo2 != null) lines.push(`- Blood oxygen: ${l.spo2}%`);

  if (!lines.length) return "";

  return `LAST NIGHT'S RECOVERY (from Apple Health — reason about CAUSES, not just numbers):
${lines.join("\n")}

How to use this — CAUSAL reasoning:
- Connect the signals to a likely CAUSE, comparing to their own baseline. Elevated resting HR + raised respiratory rate + fragmented sleep (high awake / low deep) point to under-recovery, stress, alcohol, a late/large meal, a late or very hard workout, or an oncoming illness. Low total sleep vs baseline = sleep debt.
- Cross-reference training: suppressed recovery + rising RPE / stalling lifts = accumulated fatigue → prescribe a lighter day or deload.
- When they ask "why did I sleep badly" or "why am I flat", answer with the specific signal(s) and the most likely cause in ONE or two sentences, citing their numbers vs baseline, then ONE corrective action (e.g. "no training load today, caffeine cut-off 2pm, lights out 30min earlier").
- Never medically diagnose. If resting HR is sharply elevated with low blood oxygen, note they may be getting sick and should prioritise rest — framed as a suggestion, not a diagnosis.`;
}
