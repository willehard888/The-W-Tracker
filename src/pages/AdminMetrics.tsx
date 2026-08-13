import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Loader2, Users, Flame, CreditCard, Share2, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import AnimatedNumber from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";

/**
 * Founder Command Center — the four growth dashboards over the admin RPCs
 * (admin_metrics_overview / admin_retention_cohorts / admin_funnel /
 * admin_virality). Client gate is cosmetic; the RPCs enforce has_role(admin)
 * server-side and RAISE for anyone else.
 */

type Overview = Record<string, number | string | null>;
type CohortRow = {
  cohort_week: string;
  cohort_size: number;
  d1_pct: number | null;
  d7_pct: number | null;
  d30_pct: number | null;
};
type Funnel = { window_days: number; unique_users_by_step: Record<string, number> };
type Virality = {
  window_days: number;
  invites_shared: number;
  distinct_sharers: number;
  referred_signups: number;
  total_referred_ever: number;
  k_factor: number | null;
};

// Display order mirrors the actual user journey; conversion % is step/first.
const ACTIVATION_STEPS = [
  ["signup", "Signup"],
  ["healthkit_connected", "HealthKit connected"],
  ["checkin_completed", "Check-in done"],
  ["checkin_verified", "Check-in verified"],
  ["streak_milestone", "Streak milestone"],
] as const;
const MONETIZATION_STEPS = [
  ["paywall_viewed", "Paywall viewed"],
  ["purchase_started", "Purchase started"],
  ["purchase_completed", "Purchase completed"],
] as const;

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

const retentionHeat = (pct: number | null) =>
  pct == null
    ? "text-muted-foreground/40"
    : pct >= 40
      ? "text-xp-green font-bold"
      : pct >= 20
        ? "text-gold font-bold"
        : pct > 0
          ? "text-foreground/80"
          : "text-muted-foreground/40";

const StatTile = ({
  label,
  value,
  format: fmt,
  accent,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  accent?: boolean;
}) => (
  <div
    className={cn(
      "rounded-xl border p-3",
      accent ? "border-gold/40 bg-gold/[0.06]" : "border-border/60 bg-card/40",
    )}
  >
    <AnimatedNumber
      value={value}
      format={fmt}
      className={cn("font-display text-xl font-black tracking-tight", accent && "text-gold")}
    />
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
      {label}
    </p>
  </div>
);

const SectionHeader = ({ icon: Icon, title, sub }: { icon: typeof Users; title: string; sub?: string }) => (
  <div className="flex items-center gap-2 mb-3 mt-8 first:mt-0">
    <div className="h-7 w-7 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center">
      <Icon size={13} className="text-gold" />
    </div>
    <h2 className="font-display font-bold text-base tracking-tight">{title}</h2>
    {sub && <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">{sub}</span>}
  </div>
);

const FunnelBars = ({ steps, byStep }: { steps: ReadonlyArray<readonly [string, string]>; byStep: Record<string, number> }) => {
  const first = num(byStep[steps[0][0]]);
  return (
    <div className="space-y-2">
      {steps.map(([key, label], i) => {
        const v = num(byStep[key]);
        const prev = i === 0 ? v : num(byStep[steps[i - 1][0]]);
        const widthPct = first > 0 ? Math.max((v / first) * 100, v > 0 ? 4 : 0) : 0;
        const stepPct = i === 0 ? null : prev > 0 ? Math.round((v / prev) * 100) : null;
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px] font-semibold text-foreground/85">{label}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {v.toLocaleString()}
                {stepPct != null && (
                  <span className={cn("ml-1.5 font-bold", stepPct >= 50 ? "text-xp-green" : stepPct >= 20 ? "text-gold" : "text-destructive/80")}>
                    {stepPct}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-all duration-700"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function AdminMetrics() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const { data: overview } = useQuery({
    queryKey: ["admin-metrics-overview"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_metrics_overview" as never);
      if (error) throw error;
      return (data ?? {}) as unknown as Overview;
    },
  });

  const { data: cohorts } = useQuery({
    queryKey: ["admin-retention-cohorts"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_retention_cohorts" as never, { p_weeks: 8 } as never);
      if (error) throw error;
      return (data ?? []) as unknown as CohortRow[];
    },
  });

  const { data: funnel } = useQuery({
    queryKey: ["admin-funnel"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_funnel" as never, { p_days: 30 } as never);
      if (error) throw error;
      return data as unknown as Funnel;
    },
  });

  const { data: virality } = useQuery({
    queryKey: ["admin-virality"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_virality" as never, { p_days: 30 } as never);
      if (error) throw error;
      return data as unknown as Virality;
    },
  });

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const o = overview ?? {};
  const steps = funnel?.unique_users_by_step ?? {};

  return (
    <div className="min-h-screen pb-12 px-4 pt-6 max-w-lg mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="h-5 w-5 text-gold" />
          <h1 className="font-display text-2xl font-bold tracking-tight">Command Center</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          The numbers the machine is steered by. Activity, retention, funnel, virality.
        </p>
        <a
          href="/admin/moderation"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold hover:underline"
        >
          → Moderation queue
        </a>
      </div>

      {/* 1 — Headline KPIs */}
      <SectionHeader icon={Users} title="Pulse" sub="live" />
      {!overview ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gold/60" /></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="DAU" value={num(o.dau)} accent />
            <StatTile label="WAU" value={num(o.wau)} accent />
            <StatTile label="MAU" value={num(o.mau)} accent />
            <StatTile
              label="Stickiness"
              value={Math.round(num(o.stickiness_dau_mau) * 100)}
              format={(n) => `${n}%`}
            />
            <StatTile label="Check-ins today" value={num(o.checkins_today)} />
            <StatTile label="Active streaks" value={num(o.active_streaks)} />
            <StatTile label="Total users" value={num(o.total_users)} />
            <StatTile label="New (7d)" value={num(o.new_7d)} />
            <StatTile label="Longest streak" value={num(o.longest_streak)} />
          </div>

          <SectionHeader icon={CreditCard} title="Money" sub="30 days" />
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Paid members" value={num(o.paid_members)} accent />
            <StatTile label="Purchases" value={num(o.purchases_30d)} />
            <StatTile
              label="Trial → paid"
              value={Math.round(num(o.trial_conversion_30d) * 100)}
              format={(n) => `${n}%`}
              accent
            />
            <StatTile label="Trials started" value={num(o.trials_started_30d)} />
            <StatTile label="Cancellations" value={num(o.cancellations_30d)} />
            <StatTile label="Payment fails" value={num(o.payment_failures_30d)} />
          </div>
        </>
      )}

      {/* 2 — Retention cohorts */}
      <SectionHeader icon={Flame} title="Retention" sub="by signup week" />
      {!cohorts ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gold/60" /></div>
      ) : cohorts.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No cohorts yet.</p>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground uppercase tracking-wider text-[9px]">
                <th className="text-left font-semibold px-3 py-2">Week</th>
                <th className="text-right font-semibold px-2 py-2">Users</th>
                <th className="text-right font-semibold px-2 py-2">D1</th>
                <th className="text-right font-semibold px-2 py-2">D7</th>
                <th className="text-right font-semibold px-3 py-2">D30</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.cohort_week} className="border-b border-border/30 last:border-0">
                  <td className="px-3 py-2 font-semibold">{format(new Date(c.cohort_week), "MMM d")}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{c.cohort_size}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", retentionHeat(c.d1_pct))}>
                    {c.d1_pct != null ? `${c.d1_pct}%` : "—"}
                  </td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", retentionHeat(c.d7_pct))}>
                    {c.d7_pct != null ? `${c.d7_pct}%` : "—"}
                  </td>
                  <td className={cn("px-3 py-2 text-right tabular-nums", retentionHeat(c.d30_pct))}>
                    {c.d30_pct != null ? `${c.d30_pct}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3 — Funnels */}
      <SectionHeader icon={TrendingUp} title="Funnel" sub={`${funnel?.window_days ?? 30} days`} />
      {!funnel ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gold/60" /></div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Activation</p>
            <FunnelBars steps={ACTIVATION_STEPS} byStep={steps} />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Monetization</p>
            <FunnelBars steps={MONETIZATION_STEPS} byStep={steps} />
          </div>
        </div>
      )}

      {/* 4 — Virality */}
      <SectionHeader icon={Share2} title="Virality" sub={`${virality?.window_days ?? 30} days`} />
      {!virality ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gold/60" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="K-factor"
            value={Math.round(num(virality.k_factor) * 1000)}
            format={(n) => (n / 1000).toFixed(2)}
            accent
          />
          <StatTile label="Referred signups" value={num(virality.referred_signups)} />
          <StatTile label="Invites shared" value={num(virality.invites_shared)} />
          <StatTile label="Distinct sharers" value={num(virality.distinct_sharers)} />
        </div>
      )}
    </div>
  );
}
