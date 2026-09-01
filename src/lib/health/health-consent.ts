/**
 * Records that the user has deliberately connected Apple Health.
 *
 * Why this exists: `useHealthKit().available` only answers "is the plugin on
 * this platform", never "has permission been granted". The background sync
 * used to call requestAuthorization() three seconds after Home mounted, so
 * iOS raised its Health permission sheet with nothing on screen explaining
 * why. A denied Health prompt is close to permanent — iOS won't re-ask, the
 * user has to go dig through Settings — and Health data is what makes a
 * check-in verifiable and the coach's advice specific. Losing it to an
 * unexplained system dialog is the worst possible way to lose it.
 *
 * So the ask now belongs to HealthKitConnectCard, which explains itself
 * first, and this flag is what tells the background sync it is allowed to
 * touch HealthKit at all.
 *
 * Device-scoped rather than per-user because the underlying iOS permission is
 * device-scoped too. AuthContext.signOut clears it along with the rest of the
 * per-user local state so a shared device doesn't sync one account's health
 * data under the next account's name.
 */
/** Exported for AuthContext.signOut's bulk key sweep — one source of truth. */
export const HEALTH_CONSENT_KEY = "w_health_connected";
const KEY = HEALTH_CONSENT_KEY;

export const markHealthConnected = (): void => {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* storage unavailable — worst case the user is asked again, deliberately */
  }
};

export const hasHealthConsent = (): boolean => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Fail CLOSED: if we can't tell, don't prompt. An un-primed system sheet
    // is a worse outcome than a missed background sync.
    return false;
  }
};

export const clearHealthConsent = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
};
