import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LogRow {
  exercise_slug: string | null;
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  logged_on: string;
}

export interface Mover {
  name: string;
  latestWeight: number;
  deltaKg: number; // vs previous session
  isPR: boolean;
}

export interface ProgressionSummary {
  liftsThisWeek: number; // distinct exercises logged in last 7d
  setsThisWeek: number; // sets locked in the last 7d (every row, not the top set per day)
  prCount: number; // PRs (best-ever est 1RM) hit this week
  movers: Mover[]; // climbing lifts this week, biggest gain first
}

const epley = (w: number, r: number | null) => w * (1 + (r ?? 1) / 30);
const within7d = (iso: string) => Date.now() - new Date(iso).getTime() <= 7 * 86_400_000;

/** Compact strength-progress summary from logged sets — powers the profile card. */
export const useProgressionSummary = () =>
  useQuery<ProgressionSummary>({
    queryKey: ["progression-summary"],
    staleTime: 60_000,
    queryFn: async () => {
      // recent_workout_logs is the heaviest set per exercise per day — right
      // for lifts and PRs, wrong for a set count (a 4-set session read
      // "1 sets"). The sets are counted from the rows themselves.
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const [{ data, error }, setsRes] = await Promise.all([
        supabase.rpc("recent_workout_logs", { p_limit: 200 }),
        supabase.from("workout_set_logs").select("id", { count: "exact", head: true }).gte("logged_on", since),
      ]);
      if (error) throw error;
      const rows = (data as unknown as LogRow[]) ?? [];
      const setsThisWeek = setsRes.count ?? 0;

      const groups = new Map<string, LogRow[]>();
      for (const r of rows) {
        const key = r.exercise_slug || r.exercise_name;
        if (!key) continue;
        (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
      }

      let liftsThisWeek = 0;
      let prCount = 0;
      const movers: Mover[] = [];

      for (const list of groups.values()) {
        // newest-first from the RPC
        const weekLogs = list.filter((r) => within7d(r.logged_on));
        if (!weekLogs.length) continue;
        liftsThisWeek++;

        const latest = list[0];
        const prev = list[1];
        if (latest.weight != null && prev?.weight != null) {
          const delta = Number(latest.weight) - Number(prev.weight);
          if (delta > 0) {
            movers.push({ name: latest.exercise_name, latestWeight: Number(latest.weight), deltaKg: delta, isPR: false });
          }
        }

        // PR = latest est 1RM is the best across all logged sessions (need ≥2).
        const withW = list.filter((r) => r.weight != null);
        if (withW.length >= 2 && latest.weight != null) {
          const eLatest = epley(Number(latest.weight), latest.reps);
          const eBest = Math.max(...withW.map((r) => epley(Number(r.weight), r.reps)));
          if (eLatest >= eBest - 0.01) {
            prCount++;
            const m = movers.find((x) => x.name === latest.exercise_name);
            if (m) m.isPR = true;
          }
        }
      }

      movers.sort((a, b) => b.deltaKg - a.deltaKg);
      return { liftsThisWeek, setsThisWeek, prCount, movers: movers.slice(0, 3) };
    },
  });
