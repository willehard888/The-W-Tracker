import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Sparkles, Dumbbell, Moon, Brain, Droplet, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { toast } from "sonner";
import ReadinessRing from "./ReadinessRing";
import { useDailyPlan, type Mission, type MissionKind } from "@/hooks/use-daily-plan";

const KIND_META: Record<MissionKind, { icon: typeof Dumbbell; tint: string; ring: string; chip: string }> = {
  primary:  { icon: Dumbbell, tint: "from-gold/20 to-transparent", ring: "border-gold/45",      chip: "text-gold bg-gold/10" },
  recovery: { icon: Moon,     tint: "from-teal-400/20 to-transparent", ring: "border-teal-400/40", chip: "text-teal-300 bg-teal-400/10" },
  focus:    { icon: Brain,    tint: "from-violet-400/20 to-transparent", ring: "border-violet-400/40", chip: "text-violet-300 bg-violet-400/10" },
  habit:    { icon: Droplet,  tint: "from-sky-400/15 to-transparent", ring: "border-sky-400/35",  chip: "text-sky-300 bg-sky-400/10" },
  edge:     { icon: Zap,      tint: "from-rose-400/20 to-transparent", ring: "border-rose-400/45", chip: "text-rose-300 bg-rose-400/10" },
};

const ADJ_LABEL: Record<string, string> = {
  push:   "Push day — earned it.",
  hold:   "Hold the line.",
  deload: "Deload — recover smart.",
  swap:   "Recovery swap — rebuild.",
};

const DailyMissionCard = () => {
  const { plan, completedIds, total, done, generate, completeMission, isLoading } = useDailyPlan();
  const [generating, setGenerating] = useState(false);

  const onGenerate = async () => {
    setGenerating(true);
    try {
      await generate();
      hapticNotification("success");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't build today's plan.");
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/40 bg-card/40 p-5 h-40 animate-pulse" />
    );
  }

  if (!plan) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-b from-gold/[0.10] via-card/95 to-card p-5 shadow-[0_20px_60px_-20px_hsl(var(--gold)/0.35)]">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-gold" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">
            Today's Mission
          </span>
        </div>
        <h3 className="font-display text-xl font-black mb-1.5">Build today's plan</h3>
        <p className="text-[12px] text-muted-foreground mb-4 leading-snug">
          Coach reads your last 7 days — sleep, sessions, RPE, streak — and builds 3–5 high-impact missions calibrated to your readiness right now.
        </p>
        <Button variant="gold" size="lg" loading={generating} onClick={onGenerate} className="w-full font-black">
          <Sparkles size={14} /> Generate today's missions
        </Button>
      </div>
    );
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/35 bg-gradient-to-b from-gold/[0.10] via-card/95 to-card p-5 shadow-[0_20px_60px_-20px_hsl(var(--gold)/0.35)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-12 w-48 h-48 rounded-full blur-3xl opacity-60"
        style={{ background: "radial-gradient(circle, hsl(var(--gold)/0.45), transparent 70%)" }}
      />
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={12} className="text-gold" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">
                Today's Mission
              </span>
            </div>
            <h3 className="font-display text-[20px] leading-tight font-black tracking-tight">
              {plan.headline ?? ADJ_LABEL[plan.adjustment] ?? "Hold the line."}
            </h3>
          </div>
          <ReadinessRing score={plan.readiness_score} size={54} />
        </div>

        {/* Progress strip */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden border border-border/30">
            <motion.div
              className="h-full bg-gradient-to-r from-[hsl(42_88%_62%)] to-[hsl(42_78%_48%)]"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <p className="text-[11px] font-black tracking-widest text-gold whitespace-nowrap tabular-nums">
            {done}/{total}
          </p>
        </div>

        {/* Missions */}
        <ul className="space-y-2">
          {plan.missions.map((m, idx) => (
            <MissionRow
              key={m.id}
              mission={m}
              done={completedIds.has(m.id)}
              index={idx}
              onComplete={async () => {
                hapticImpact("medium");
                try {
                  const res = await completeMission(m.id);
                  hapticNotification("success");
                  toast.success(`+${res.xp_awarded} XP`, { description: m.title });
                } catch (e: any) {
                  if (e?.message === "already_completed") return;
                  toast.error(e?.message ?? "Couldn't log mission.");
                }
              }}
            />
          ))}
        </ul>

        {done === total && total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-center"
          >
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-300">
              Perfect day
            </p>
            <p className="text-[12px] text-emerald-200/85 mt-0.5">
              Every mission cleared. Coach will push tomorrow.
            </p>
          </motion.div>
        )}

        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="mt-3 w-full text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-gold transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {generating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Re-read today's data
        </button>
      </div>
    </div>
  );
};

const MissionRow = ({
  mission,
  done,
  index,
  onComplete,
}: {
  mission: Mission;
  done: boolean;
  index: number;
  onComplete: () => Promise<void>;
}) => {
  const [busy, setBusy] = useState(false);
  const meta = KIND_META[mission.kind] ?? KIND_META.habit;
  const Icon = meta.icon;

  const handle = async () => {
    if (done || busy) return;
    setBusy(true);
    await onComplete();
    setBusy(false);
  };

  return (
    <AnimatePresence mode="popLayout">
      <motion.li
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: index * 0.04 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-background/45 px-3 py-2.5 transition-colors",
          meta.ring,
          done && "opacity-60",
        )}
      >
        <div
          aria-hidden
          className={cn("absolute inset-0 bg-gradient-to-r pointer-events-none", meta.tint)}
        />
        <div className="relative flex items-center gap-3">
          <button
            type="button"
            onClick={handle}
            disabled={done || busy}
            aria-label={done ? "Completed" : "Mark complete"}
            className={cn(
              "shrink-0 h-9 w-9 rounded-full border flex items-center justify-center transition-all",
              done
                ? "bg-emerald-500/25 border-emerald-400/60 text-emerald-300"
                : "bg-background/70 border-border/60 hover:border-gold/60 hover:bg-gold/10 active:scale-95",
            )}
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : done ? (
              <Check size={14} strokeWidth={3} />
            ) : (
              <Icon size={14} />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p
                className={cn(
                  "font-bold text-[13px] leading-tight truncate",
                  done && "line-through decoration-emerald-400/60",
                )}
              >
                {mission.title}
              </p>
              <span
                className={cn(
                  "text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded-md whitespace-nowrap",
                  meta.chip,
                )}
              >
                +{mission.xp} XP
              </span>
            </div>
            {mission.detail && (
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                {mission.detail}
              </p>
            )}
          </div>
        </div>
      </motion.li>
    </AnimatePresence>
  );
};

export default DailyMissionCard;
