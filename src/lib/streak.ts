export const STREAK_WINDOW_MS = 48 * 60 * 60 * 1000;

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
