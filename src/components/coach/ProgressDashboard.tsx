import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoachProgram } from "@/hooks/use-coach-program";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Sparkline from "@/components/coach/Sparkline";
import { localDateKey } from "@/lib/date";
import { toast } from "sonner";
import { friendlyError, readEdgeError } from "@/lib/error-copy";

interface Props {
  program: CoachProgram;
}

/** The slower reads under Progress's summary card: 28 days of XP and the
 *  coach's read of the week (with its three measured stats once it answers).
 *  Week compliance lives in the page's summary now, not in a card of its own. */
const ProgressDashboard = ({ program }: Props) => {
  const { user } = useAuth();
  const [read, setRead] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const targets = program.plan_json.weekly_check_targets;

  // 28 days of XP, one number per local calendar day. react-query owns the
  // cache: the raw effect refetched on every mount of the dashboard.
  const { data: xpSeries = [] } = useQuery({
    queryKey: ["coach-progress-xp-28d", user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 28 * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("xp_earned, checked_in_at")
        .eq("user_id", user!.id)
        .gte("checked_in_at", since);
      if (error) throw error;
      // Local day, not the UTC slice the old effect used — an evening check-in
      // landed on tomorrow's bar west of Greenwich.
      const byDay = new Map<string, number>();
      for (const r of data ?? []) {
        const key = localDateKey(new Date(r.checked_in_at));
        byDay.set(key, (byDay.get(key) ?? 0) + (r.xp_earned ?? 0));
      }
      return Array.from({ length: 28 }, (_, i) =>
        byDay.get(localDateKey(new Date(Date.now() - (27 - i) * 86400_000))) ?? 0,
      );
    },
  });

  const fetchRead = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("coach-progress-read");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setRead((data as any).read);
      setStats((data as any).stats);
    } catch (e: any) {
      // A 429 used to read "Couldn't read progress." — the server had already
      // said when the limit resets.
      toast.error((await readEdgeError(e, friendlyError(e, "Couldn't read progress."))).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRead(); }, [fetchRead]);

  return (
    <div className="space-y-4">
      {/* Stat trio (last 7d). It arrives with the coach's read: before that
          it was three dashes repeating the strip at the top of the page. */}
      {stats && (
      <div className="grid grid-cols-3 gap-2">
        <Tile
          label="Workouts"
          value={`${stats?.workouts ?? "–"}`}
          target={`/${targets.workouts}`}
        />
        <Tile
          label="Avg sleep"
          value={stats?.avg_sleep_h != null ? `${stats.avg_sleep_h}h` : "–"}
          target={`/${targets.sleep_avg_h}h`}
        />
        <Tile
          label="Avg hydration"
          value={stats?.avg_hydration_l != null ? `${stats.avg_hydration_l}L` : "–"}
          target={`/${targets.hydration_l}L`}
        />
      </div>
      )}

      {/* XP trend */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp aria-hidden size={14} className="text-gold" />
          <p className="text-label font-bold text-muted-foreground">
            XP last 28 days
          </p>
        </div>
        {/* Fixed slot: the sparkline draws nothing until the series lands. */}
        <div className="h-32">
          <Sparkline values={xpSeries} className="w-full h-full" />
        </div>
      </div>

      {/* Coach read */}
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-label font-bold text-gold">
            Coach's read
          </p>
          <Button variant="ghost" size="sm" aria-label="Refresh the coach's read" onClick={fetchRead} disabled={loading} className="h-7 px-2 before:absolute before:-inset-2 before:content-['']">
            {loading ? <Loader2 aria-hidden size={12} className="animate-spin" /> : <RefreshCw aria-hidden size={12} />}
          </Button>
        </div>
        {loading && !read ? (
          <p className="text-meta text-muted-foreground">Reading your last 7 days…</p>
        ) : read ? (
          <div className="text-dense coach-md coach-md-gold">
            <ReactMarkdown>{read}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-meta text-muted-foreground">
            Tap refresh to get a fresh read on your progress.
          </p>
        )}
      </div>

      <p className="text-label text-muted-foreground/75 text-center italic">
        Educational guidance — not medical advice.
      </p>
    </div>
  );
};

const Tile = ({ label, value, target }: { label: string; value: string; target: string }) => (
  <div className="rounded-xl border border-border/60 bg-card/60 p-3 text-center">
    <p className="font-display text-xl font-black text-gold leading-none">
      {value}
      <span className="text-label font-bold text-muted-foreground">{target}</span>
    </p>
    <p className="text-label font-bold text-muted-foreground mt-1">{label}</p>
  </div>
);

export default ProgressDashboard;
