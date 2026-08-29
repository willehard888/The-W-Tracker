import { useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CoachProgram, ProgramLog } from "@/hooks/use-coach-program";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from "recharts";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";

interface Props {
  program: CoachProgram;
  currentWeek: number;
  logs: ProgramLog[];
}

const ProgressDashboard = ({ program, currentWeek, logs }: Props) => {
  const { user } = useAuth();
  const [read, setRead] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [xpSeries, setXpSeries] = useState<{ d: string; xp: number }[]>([]);

  const targets = program.plan_json.weekly_check_targets;

  // Compliance for current week
  const weekLogs = logs.filter((l) => l.week === currentWeek && l.completed).length;
  const weekDays = program.plan_json.weeks.find((w) => w.week === currentWeek)?.days ?? [];
  const activeTargetDays = weekDays.filter((d) => d.focus.toLowerCase() !== "rest").length || 1;
  const compliance = Math.round((weekLogs / activeTargetDays) * 100);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const ago = new Date(Date.now() - 28 * 86400_000).toISOString();
      const { data } = await supabase
        .from("daily_checkins")
        .select("xp_earned, checked_in_at")
        .eq("user_id", user.id)
        .gte("checked_in_at", ago)
        .order("checked_in_at", { ascending: true });
      const map = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const d = new Date(r.checked_in_at).toISOString().slice(5, 10);
        map.set(d, (map.get(d) ?? 0) + (r.xp_earned ?? 0));
      });
      // Build last 28-day series
      const out: { d: string; xp: number }[] = [];
      for (let i = 27; i >= 0; i--) {
        const dt = new Date(Date.now() - i * 86400_000);
        const key = dt.toISOString().slice(5, 10);
        out.push({ d: key, xp: map.get(key) ?? 0 });
      }
      setXpSeries(out);
    };
    load();
  }, [user]);

  const fetchRead = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("coach-progress-read");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setRead((data as any).read);
      setStats((data as any).stats);
    } catch (e: any) {
      toast.error(friendlyError(e, "Couldn't read progress."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRead(); }, [fetchRead]);

  return (
    <div className="space-y-4">
      {/* Compliance */}
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.08] to-card p-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[11px] font-black tracking-[0.22em] uppercase text-gold">
            Week {currentWeek} compliance
          </p>
          <p className="font-display text-3xl font-black text-gold leading-none">{compliance}%</p>
        </div>
        <Progress value={compliance} />
        <p className="text-[12px] text-muted-foreground mt-2">
          {weekLogs} of {activeTargetDays} planned sessions logged.
        </p>
      </div>

      {/* Stat trio (last 7d) */}
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

      {/* XP trend */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} className="text-gold" />
          <p className="text-[11px] font-black tracking-[0.22em] uppercase text-muted-foreground">
            XP last 28 days
          </p>
        </div>
        <div className="h-32 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={xpSeries}>
              <defs>
                <linearGradient id="xpGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="d" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 11,
                }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="xp"
                stroke="hsl(var(--gold))"
                strokeWidth={2}
                fill="url(#xpGold)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Coach read */}
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-black tracking-[0.22em] uppercase text-gold">
            Coach's read
          </p>
          <Button variant="ghost" size="sm" onClick={fetchRead} disabled={loading} className="h-7 px-2">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </Button>
        </div>
        {loading && !read ? (
          <p className="text-[12px] text-muted-foreground">Reading your last 7 days…</p>
        ) : read ? (
          <div className="text-[13px] prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-strong:text-gold">
            <ReactMarkdown>{read}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            Tap refresh to get a fresh read on your progress.
          </p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/70 text-center italic">
        Educational guidance — not medical advice.
      </p>
    </div>
  );
};

const Tile = ({ label, value, target }: { label: string; value: string; target: string }) => (
  <div className="rounded-xl border border-border/60 bg-card/60 p-3 text-center">
    <p className="font-display text-xl font-black text-gold leading-none">
      {value}
      <span className="text-[11px] font-bold text-muted-foreground">{target}</span>
    </p>
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
  </div>
);

export default ProgressDashboard;
