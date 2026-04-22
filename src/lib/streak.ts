export const STREAK_WINDOW_MS = 48 * 60 * 60 * 1000;

/** 0–6 tier ladder. Tier 6 = Inferno (200d+) — the plasma ceiling above Legendary. */
export const personalStreakTier = (streak: number): number => {
  if (streak >= 200) return 6; // Inferno
  if (streak >= 100) return 5; // Legendary
  if (streak >= 60)  return 4; // Diamond
  if (streak >= 30)  return 3; // Blazing / Champion
  if (streak >= 14)  return 2; // On Fire
  if (streak >= 7)   return 1; // Heating Up
  if (streak >= 3)   return 0; // Ignited
  return -1;
};

export const isInferno = (streak: number) => personalStreakTier(streak) >= 6;


export type StreakDeadlineState = {
  expired: boolean;
  hours: number;
  mins: number;
  urgent: boolean;
};

const getLastCheckinMs = (lastCheckinAt?: string | null) => {
  if (!lastCheckinAt) return null;
  const ms = new Date(lastCheckinAt).getTime();
  return Number.isNaN(ms) ? null : ms;
};

export const getEffectiveStreak = (streak: number, lastCheckinAt?: string | null) => {
  if (streak <= 0) return 0;

  const lastCheckinMs = getLastCheckinMs(lastCheckinAt);
  if (!lastCheckinMs) return streak;

  return Date.now() - lastCheckinMs >= STREAK_WINDOW_MS ? 0 : streak;
};

export const getStreakDeadlineState = (
  streak: number,
  lastCheckinAt?: string | null,
): StreakDeadlineState | null => {
  if (streak <= 0) return null;

  const lastCheckinMs = getLastCheckinMs(lastCheckinAt);
  if (!lastCheckinMs) return null;

  const remainingMs = lastCheckinMs + STREAK_WINDOW_MS - Date.now();

  if (remainingMs <= 0) {
    return { expired: true, hours: 0, mins: 0, urgent: true };
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    expired: false,
    hours,
    mins,
    urgent: hours < 6,
  };
};
