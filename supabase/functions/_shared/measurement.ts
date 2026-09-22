// Mirrored verbatim at supabase/functions/_shared/measurement.ts — the edge
// runtime cannot import from src/, and a parity test asserts the two match.
//
// Missing is not zero.
//
// WHY THIS EXISTS
//
// A member got a push notification saying "Your zero hours of recorded sleep
// make high-intensity training dangerous today. Cancel your workout." He had
// slept, and had logged it. What he had not done was wear a watch.
//
// The chain, from the bottom:
//
//   HealthNight.swift ran the sleep query, got an empty sample array, summed
//   it to 0 and wrote `sleep_total_min: 0` — a measurement of zero rather than
//   no measurement. The client's `?? undefined` guard saw a number and passed
//   it. The row-has-data guard saw `0 != null` and wrote the row. The proactive
//   notifier's `sleep_total_min != null && < 360` was satisfied by that zero,
//   and the model was handed "only 0h 0m sleep" as fact.
//
// Every one of those steps is individually reasonable. Together they turn a
// missing wearable into a medical-sounding instruction to cancel training.
//
// THE RULE
//
// A physiological measurement of zero is not a measurement. Nobody sleeps zero
// minutes, has a resting heart rate of zero, or an HRV of zero — a zero in
// those columns means the sensor had nothing to say. Counts are different:
// zero steps is a real and ordinary fact about a day spent in bed, so this must
// never be applied to them.

/**
 * Is this a real reading of something that cannot legitimately be zero?
 *
 * For sleep minutes, resting heart rate, HRV and body mass. NOT for steps,
 * active calories, workouts or anything else where zero is a true value a
 * person can actually have.
 */
export const isVitalReading = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

/** The value when it is a real reading, otherwise null. Never 0. */
export const vitalOrNull = (v: number | null | undefined): number | null =>
  isVitalReading(v) ? v : null;

/**
 * Mean of the readings that actually exist.
 *
 * The bug this prevents is quieter than the notification but more widespread:
 * `values.reduce((s, v) => s + (v ?? 0), 0) / values.length` divides by every
 * day, including the days with no reading, so a week with three logged nights
 * of 8 h reports an average of 3.4 h. Six edge functions did exactly that with
 * sleep before this existed.
 *
 * Returns null rather than a number when nothing was measured, so the caller
 * has to decide what to say about it instead of being handed a plausible zero.
 */
export const meanOfPresent = (values: ReadonlyArray<number | null | undefined>): number | null => {
  const present = values.filter(isVitalReading);
  return present.length === 0 ? null : present.reduce((s, v) => s + v, 0) / present.length;
};

/** How many of the readings were real — for saying "3 of 7 nights". */
export const presentCount = (values: ReadonlyArray<number | null | undefined>): number =>
  values.filter(isVitalReading).length;

/**
 * What to tell a language model about a number it must not invent around.
 *
 * "unknown" is a deliberate word rather than a blank or a zero: a model handed
 * `sleep: 0` reasons about zero, and a model handed nothing at all fills the
 * gap. Given "unknown" it says so.
 */
export const describeVital = (
  v: number | null | undefined,
  unit: string,
  digits = 1,
): string => (isVitalReading(v) ? `${v.toFixed(digits)}${unit}` : "unknown (not measured)");
