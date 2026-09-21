// Where a breathing pattern or a cue script is at, from elapsed time alone.
//
// Both read the runner's deadline clock, so a pacer that was backgrounded, or a
// tick that arrived late, lands on the right phase instead of drifting — the
// same reason the runner's timer counts down to a timestamp.
import type { BreathPhase } from "@/data/recovery";

export interface PacePoint {
  /** Index into the pattern. */
  index: number;
  label: BreathPhase[0];
  /** Seconds this phase lasts. */
  sec: number;
}

export const cycleSec = (pace: BreathPhase[]): number => pace.reduce((sum, [, s]) => sum + s, 0);

/** The phase of the pattern at `elapsedMs` into the hold, repeating. */
export function breathPhase(pace: BreathPhase[], elapsedMs: number): PacePoint {
  const cycle = cycleSec(pace) * 1000;
  let t = cycle > 0 ? Math.max(0, elapsedMs) % cycle : 0;
  for (let index = 0; index < pace.length; index++) {
    const ms = pace[index][1] * 1000;
    if (t < ms) return { index, label: pace[index][0], sec: pace[index][1] };
    t -= ms;
  }
  return { index: 0, label: pace[0][0], sec: pace[0][1] };
}

/**
 * How full the pacer circle is at the END of phase `index` (0.55–1). In fills,
 * out empties, a hold keeps what the phase before it left. A second "In" in a
 * row (the double inhale) tops up from part-full rather than restarting.
 */
export function pacerScale(pace: BreathPhase[], index: number): number {
  const label = pace[index][0];
  if (label === "Out") return 0.55;
  if (label === "In") return pace[(index + 1) % pace.length][0] === "In" ? 0.85 : 1;
  return index === 0 ? 0.55 : pacerScale(pace, index - 1);
}

/**
 * How full the breath is at the END of phase `index`, 0 (breathed out) to 1
 * (breathed in) — the pacer circle's scale, on a unit range, so a drawing can
 * cross-fade between its exhaled and inhaled frames on the same clock.
 */
export const breathFullness = (pace: BreathPhase[], index: number): number =>
  (pacerScale(pace, index) - 0.55) / 0.45;

/** The cue showing at `elapsedMs`: the last one whose second has passed. */
export function cueIndex(cues: [number, string][], elapsedMs: number): number {
  let at = 0;
  for (let i = 0; i < cues.length; i++) if (cues[i][0] * 1000 <= elapsedMs) at = i;
  return at;
}
