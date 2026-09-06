/**
 * Finished session → Apple Health workout (opt-in, iOS only, fire-and-forget).
 *
 * Same contract as meal-write: every function resolves `false` instead of
 * throwing. Off-platform, no consent, denied permission or a native error all
 * mean "nothing was written", and finishing a session never waits on or fails
 * because of HealthKit. Failures go to captureException.
 */
import { Capacitor } from "@capacitor/core";
import { captureException } from "@/lib/observability";
import { HealthNight } from "./night-metrics";
import {
  clearWorkoutWriteConsent,
  hasWorkoutWriteConsent,
  markWorkoutWriteEnabled,
} from "./health-consent";

export { hasWorkoutWriteConsent };

/** "Not now" on the summary offer — remembered so the question is asked once. */
const DECLINED_KEY = "w_health_write_workouts_declined";

export interface HealthWorkout {
  /** Stable per session (program-week-day): a re-finish replaces, not duplicates. */
  id: string;
  startIso: string;
  endIso: string;
}

const isIos = () => Capacitor.getPlatform() === "ios";
const report = (where: string, e: unknown) => captureException(e, { where });

/**
 * Ask for HealthKit share permission for workouts and, if granted, remember it.
 * The caller shows the "why" first — this raises the system sheet.
 */
export async function enableWorkoutWrite(): Promise<boolean> {
  if (!isIos()) return false;
  try {
    const r = await HealthNight.requestWorkoutWriteAuthorization();
    if (!r?.granted) return false;
    markWorkoutWriteEnabled();
    return true;
  } catch (e) {
    report("enableWorkoutWrite", e);
    return false;
  }
}

/** Local toggle only — iOS permission stays as the user set it in Health. */
export function disableWorkoutWrite(): void {
  clearWorkoutWriteConsent();
}

export function markWorkoutWriteDeclined(): void {
  try {
    localStorage.setItem(DECLINED_KEY, "1");
  } catch {
    /* storage unavailable — the offer comes back, which is the safe side */
  }
}

export function isWorkoutWriteDeclined(): boolean {
  try {
    return localStorage.getItem(DECLINED_KEY) === "1";
  } catch {
    return false;
  }
}

export async function writeWorkoutToHealth(w: HealthWorkout): Promise<boolean> {
  if (!isIos() || !hasWorkoutWriteConsent()) return false;
  try {
    const r = await HealthNight.writeWorkout({ session_id: w.id, start: w.startIso, end: w.endIso });
    return !!r?.written;
  } catch (e) {
    report("writeWorkoutToHealth", e);
    return false;
  }
}
