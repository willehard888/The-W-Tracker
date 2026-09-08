import { fmtInt } from "@/lib/format";
import { useEffect, useRef, useState } from "react";
import { DetailSkeleton } from "@/components/skeletons/PageSkeleton";
import { useParams, useNavigate } from "react-router-dom";
import { backOr } from "@/lib/nav";
import { Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import EmptyState from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FactRow } from "@/components/coach/rows";
import { hapticImpact } from "@/lib/haptics";
import { toast } from "sonner";
import BriefingShareCard from "@/components/BriefingShareCard";
import html2canvas from "html2canvas";

/**
 * /briefing/:id — a letter from the coach. The briefing's own headline opens
 * it, the summary is the body, the week's numbers are facts, and the insights
 * and next week's protocol follow as prose under hairline rules. The share
 * card at the end is the only colour block.
 */

interface Briefing {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  headline: string;
  summary_md: string;
  key_insights: Array<{ icon: string; title: string; detail: string }>;
  next_week_protocol: Array<{ action: string; why: string }>;
  stats_snapshot: {
    total_xp?: number;
    days_checked_in?: number;
    perfect_days?: number;
    workouts?: number;
    cold_showers?: number;
    avg_sleep?: number;
    avg_hydration?: number;
    completion_pct?: number;
    best_day?: { date: string; xp: number } | null;
    worst_day?: { date: string; xp: number } | null;
  };
  generated_at: string;
  viewed_at: string | null;
}

const utc = (iso: string) => new Date(iso + "T00:00:00Z");

const formatDateRange = (start: string, end: string) => {
  const fmt = (s: string) =>
    utc(s).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
};

/** ISO week number: the week that holds the Thursday. */
const isoWeek = (iso: string) => {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - jan1) / 86400000 + 1) / 7);
};

const weekday = (iso: string) =>
  utc(iso).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

const WeeklyBriefing = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setStatus("loading");
    (async () => {
      const { data, error } = await supabase
        .from("weekly_briefings")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (error) { setStatus("failed"); return; }
      if (!data) { setStatus("missing"); return; }
      setBriefing(data as unknown as Briefing);
      setStatus("ready");

      if (!data.viewed_at) {
        await supabase
          .from("weekly_briefings")
          .update({ viewed_at: new Date().toISOString() })
          .eq("id", id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const handleShare = async () => {
    if (!shareRef.current || !briefing) return;
    setSharing(true);
    hapticImpact("medium");
    try {
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: null,
        scale: 1,
        useCORS: true,
      });
      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), "image/png", 0.95),
      );
      if (!blob) throw new Error("Failed to render");

      const file = new File([blob], `weekly-briefing-${briefing.week_start}.png`, {
        type: "image/png",
      });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My W Weekly Briefing",
          text: briefing.headline,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `weekly-briefing-${briefing.week_start}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Image downloaded");
      }
    } catch (e) {
      console.error(e);
      toast.error("Share failed");
    } finally {
      setSharing(false);
    }
  };

  if (status !== "ready" || !briefing) {
    return (
      <div className="min-h-full">
        <PageBar onBack={() => backOr(navigate, "/coach")} />
        <div className="px-4 pt-4">
          {status === "failed" ? (
            <ErrorState title="Couldn't load this briefing" onRetry={() => setAttempt((n) => n + 1)} />
          ) : status === "missing" ? (
            <EmptyState
              title="This briefing isn't here"
              description="It may have been removed, or the link is old. Your coach has the rest."
              action={
                <Button variant="gold-outline" size="sm" className="min-h-11" onClick={() => navigate("/coach", { replace: true })}>
                  Go to Coach
                </Button>
              }
            />
          ) : (
            <DetailSkeleton />
          )}
        </div>
      </div>
    );
  }

  const stats = briefing.stats_snapshot ?? {};
  const weekRange = formatDateRange(briefing.week_start, briefing.week_end);

  return (
    <div className="min-h-full">
      <PageBar onBack={() => backOr(navigate, "/coach")} />
      <div className="px-4 pt-4 pb-6">
        {/* ── OPENING BEAT — the dateline, then the coach's own headline. ── */}
        <header className="home-rise">
          <p className="eyebrow">Week {isoWeek(briefing.week_start)} · {weekRange}</p>
          <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight mt-1.5">
            {briefing.headline}
          </h1>
          <p className="mt-2 text-[15px] leading-snug">
            <span className="text-gold glow-gold-text font-black tabular-nums">{fmtInt(stats.total_xp ?? 0)} XP</span>
            <span className="text-muted-foreground"> this week.</span>
          </p>
        </header>

        {/* ── THE BODY — the letter itself. ── */}
        <div className="home-rise home-rise-1 mt-5 prose prose-invert prose-sm max-w-none prose-p:text-foreground/85 prose-p:leading-relaxed prose-strong:text-foreground prose-headings:text-foreground">
          <ReactMarkdown>{briefing.summary_md}</ReactMarkdown>
        </div>

        {/* ── THE NUMBERS — facts, not tiles. ── */}
        <div className="home-rise home-rise-2 mt-5 divide-y divide-border/35 border-t border-border/35">
          <FactRow k="Perfect days" v={`${stats.perfect_days ?? 0} of 7`} />
          <FactRow k="Workouts" v={`${stats.workouts ?? 0} of 7`} />
          <FactRow k="Check-ins" v={`${stats.days_checked_in ?? 0} of 7`} />
          {stats.best_day && (
            <FactRow k="Best day" v={`${weekday(stats.best_day.date)} · ${fmtInt(stats.best_day.xp)} XP`} />
          )}
        </div>

        {/* ── WHAT STOOD OUT ── */}
        {briefing.key_insights?.length > 0 && (
          <section className="home-rise home-rise-3 mt-7">
            <h2 className="font-display font-black text-[17px] leading-tight tracking-tight">What stood out</h2>
            <div className="mt-1 divide-y divide-border/35">
              {briefing.key_insights.map((insight, i) => (
                <div key={i} className="py-3.5">
                  <p className="text-[14px] font-bold leading-snug">{insight.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground leading-snug">{insight.detail}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── NEXT WEEK — numbered plainly. ── */}
        {briefing.next_week_protocol?.length > 0 && (
          <section className="home-rise home-rise-4 mt-7">
            <h2 className="font-display font-black text-[17px] leading-tight tracking-tight">Next week</h2>
            <ol className="mt-1 divide-y divide-border/35">
              {briefing.next_week_protocol.map((item, i) => (
                <li key={i} className="py-3.5 flex gap-3">
                  <span className="w-5 shrink-0 text-[14px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold leading-snug">{item.action}</span>
                    <span className="block mt-0.5 text-[13px] text-muted-foreground leading-snug">{item.why}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="home-rise home-rise-5 mt-8">
          <Button variant="ember" size="xl" className="w-full" onClick={handleShare} loading={sharing}>
            <Share2 size={18} />
            Share this week
          </Button>
        </div>

        {/* Offscreen share card */}
        <div style={{ position: "fixed", top: -10000, left: -10000, pointerEvents: "none" }}>
          <BriefingShareCard
            ref={shareRef}
            username={profile?.username ?? "operator"}
            weekRange={weekRange}
            headline={briefing.headline}
            totalXp={stats.total_xp ?? 0}
            perfectDays={stats.perfect_days ?? 0}
            workouts={stats.workouts ?? 0}
            daysCheckedIn={stats.days_checked_in ?? 0}
          />
        </div>
      </div>
    </div>
  );
};

export default WeeklyBriefing;
