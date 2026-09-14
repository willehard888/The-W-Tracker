/**
 * Whether the shell should send this user to /onboarding.
 *
 * The DB flag (`profiles.onboarded_at`) is the authority; localStorage is a
 * same-device fast path. While the profile is still unknown (the auth
 * context flips `loading` off after an 8 s race even when the row has not
 * arrived) the answer is "no": two onboarded users were being replayed the
 * flow up to seven times a day on devices without the local flag, and
 * skipping it every time. Fail open, exactly like the paywall gate below it
 * — the gate re-runs the moment the profile lands.
 */
export const shouldGateOnboarding = (
  profile: { onboarded_at?: string | null } | null | undefined,
  onboardedLocally: boolean,
): boolean => {
  if (!profile) return false;
  if (onboardedLocally) return false;
  return !profile.onboarded_at;
};
