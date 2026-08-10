import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Growth-mirror data for the Journey page. Two lightweight queries over data the
 * app already writes but never surfaced back to the user:
 *   • coach_reflections — the daily win/friction/mood diary (was write-only)
 *   • daily_checkins    — xp_earned + sleep_hours over the window, for trends
 * Everything the page needs to answer "how far have I come?" without new schema.
 */

export interface JourneyReflection {
  reflection_date: string;
  win: string | null;
  friction: string | null;
  mood_1to5: number | null;
  energy_1to5: number | null;
}

export interface JourneyCheckin {
  /** local-ish ISO date string (YYYY-MM-DD) */
  date: string;
  xp: number;
  sleep: number;
}

export interface JourneyData {
  reflections: JourneyReflection[];
  /** oldest → newest */
  checkins: JourneyCheckin[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const useJourney = (windowDays = 56) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["journey", user?.id, windowDays],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<JourneyData> => {
      const since = new Date(Date.now() - windowDays * DAY_MS).toISOString();

      const [refRes, ciRes] = await Promise.all([
        supabase
          .from("coach_reflections")
          .select("reflection_date, win, friction, mood_1to5, energy_1to5")
          .eq("user_id", user!.id)
          .order("reflection_date", { ascending: false })
          .limit(90),
        supabase
          .from("daily_checkins")
          .select("checked_in_at, xp_earned, sleep_hours")
          .eq("user_id", user!.id)
          .gte("checked_in_at", since)
          .order("checked_in_at", { ascending: true }),
      ]);

      if (refRes.error) throw refRes.error;
      if (ciRes.error) throw ciRes.error;

      const reflections: JourneyReflection[] = (refRes.data ?? []).map((r: any) => ({
        reflection_date: r.reflection_date,
        win: r.win,
        friction: r.friction,
        mood_1to5: r.mood_1to5,
        energy_1to5: r.energy_1to5,
      }));

      const checkins: JourneyCheckin[] = (ciRes.data ?? []).map((r: any) => {
        // LOCAL date (mirrors use-daily-plan's todayISO) — slicing the raw
        // timestamptz took the UTC date, which pushed late-evening/early-
        // morning check-ins into the wrong day and even the wrong ISO week.
        const d = new Date(r.checked_in_at);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return {
          date,
          xp: Number(r.xp_earned) || 0,
          sleep: Number(r.sleep_hours) || 0,
        };
      });

      return { reflections, checkins };
    },
  });
};

/** ISO week key (YYYY-Www) for bucketing check-ins into weekly XP totals. */
const isoWeekKey = (iso: string): string => {
  const d = new Date(iso + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3); // nearest Thursday
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((d.getTime() - firstThu.getTime()) / DAY_MS - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

/** Sum XP into chronological weekly buckets (oldest → newest). */
export const weeklyXp = (checkins: JourneyCheckin[]): number[] => {
  const buckets = new Map<string, number>();
  for (const c of checkins) {
    const k = isoWeekKey(c.date);
    buckets.set(k, (buckets.get(k) ?? 0) + c.xp);
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
};
