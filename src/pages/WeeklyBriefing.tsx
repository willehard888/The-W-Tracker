import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  TrendingUp,
  AlertTriangle,
  Trophy,
  Eye,
  Share2,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import { toast } from "sonner";
import BriefingShareCard from "@/components/BriefingShareCard";
import html2canvas from "html2canvas";

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

const insightIcon = (kind: string) => {
  switch (kind) {
    case "warning":
      return <AlertTriangle size={18} className="text-orange-400" />;
    case "win":
      return <Trophy size={18} className="text-gold" />;
    case "pattern":
      return <Eye size={18} className="text-purple-300" />;
    case "trend":
    default:
      return <TrendingUp size={18} className="text-gold" />;
  }
};

const formatDateRange = (start: string, end: string) => {
  const fmt = (s: string) =>
    new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(start)} – ${fmt(end)}`;
};

const WeeklyBriefing = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("weekly_briefings")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        toast.error("Briefing not found");
        navigate("/", { replace: true });
        return;
      }
      setBriefing(data as unknown as Briefing);
      setLoading(false);

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
  }, [id, navigate]);

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

  if (loading || !briefing) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-gold animate-spin" />
      </div>
    );
  }

  const stats = briefing.stats_snapshot ?? {};

  return (
    <div className="h-full overflow-y-auto pb-8 px-4 pt-4 relative">
      {/* Ambient gold glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[420px] pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse at center top, hsl(var(--gold) / 0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10">
        <button
          onClick={() => navigate(-1)}
          className="shrink-0 -ml-1 mb-2 h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground active:scale-90 active:text-foreground transition-transform"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-gold/80 font-bold mb-2">
            Weekly Briefing · {formatDateRange(briefing.week_start, briefing.week_end)}
          </p>
          <h1 className="font-display font-black text-2xl leading-tight tracking-tight text-gradient-gold">
            "{briefing.headline}"
          </h1>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          <StatTile label="Week XP" value={(stats.total_xp ?? 0).toLocaleString()} />
          <StatTile label="Perfect Days" value={`${stats.perfect_days ?? 0}/7`} />
          <StatTile label="Workouts" value={`${stats.workouts ?? 0}/7`} />
          <StatTile label="Check-ins" value={`${stats.days_checked_in ?? 0}/7`} />
        </motion.div>

        {/* Key insights */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-6"
        >
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">
            Key Insights
          </h2>
          <div className="space-y-2">
            {briefing.key_insights?.map((insight, i) => (
              <div
                key={i}
                className="rounded-xl glass-card p-4 border border-gold/15 flex gap-3"
              >
                <div className="shrink-0 mt-0.5">{insightIcon(insight.icon)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm leading-tight mb-0.5">
                    {insight.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {insight.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Next week protocol */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-6"
        >
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">
            Next Week Protocol
          </h2>
          <div className="space-y-2">
            {briefing.next_week_protocol?.map((item, i) => (
              <div
                key={i}
                className="rounded-xl glass-card-gold p-4 border border-gold/25"
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-display font-black text-gold text-base tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="font-bold text-sm leading-tight flex-1">
                    {item.action}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground leading-snug ml-6">
                  {item.why}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-6 rounded-xl glass-card p-4 prose prose-invert prose-sm max-w-none prose-p:text-muted-foreground prose-strong:text-foreground prose-headings:text-foreground"
        >
          <ReactMarkdown>{briefing.summary_md}</ReactMarkdown>
        </motion.div>

        {/* Share button */}
        <Button
          variant="ember"
          size="xl"
          className="w-full"
          onClick={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Share2 size={18} />
          )}
          {sharing ? "Generating..." : "Share Briefing"}
        </Button>
      </div>

      {/* Offscreen share card */}
      <div
        style={{
          position: "fixed",
          top: -10000,
          left: -10000,
          pointerEvents: "none",
        }}
      >
        <BriefingShareCard
          ref={shareRef}
          username={profile?.username ?? "operator"}
          weekRange={formatDateRange(briefing.week_start, briefing.week_end)}
          headline={briefing.headline}
          totalXp={stats.total_xp ?? 0}
          perfectDays={stats.perfect_days ?? 0}
          workouts={stats.workouts ?? 0}
          daysCheckedIn={stats.days_checked_in ?? 0}
        />
      </div>
    </div>
  );
};

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl glass-card border border-gold/15 p-4">
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
      {label}
    </p>
    <p className="font-display font-black text-2xl text-gold tabular-nums">{value}</p>
  </div>
);

export default WeeklyBriefing;
