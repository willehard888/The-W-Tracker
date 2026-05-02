import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Flame, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { toast } from "sonner";
import {
  PILLARS,
  getProtocol,
  getHabitLevel,
  nextHabitLevel,
  HABIT_LEVELS,
} from "@/lib/wellness-framework";
import EvidenceChip from "./EvidenceChip";
import type { UserHabit } from "@/hooks/use-user-habits";

interface Props {
  habit: UserHabit;
  doneToday: boolean;
  onLog: () => Promise<void>;
  onArchive: () => Promise<void>;
  onOpen: () => void;
}

const HabitCard = ({ habit, doneToday, onLog, onArchive, onOpen }: Props) => {
  const [busy, setBusy] = useState(false);
  const protocol = getProtocol(habit.protocol_id);
  if (!protocol) return null;

  const pillar = PILLARS[protocol.pillar];
  const level = getHabitLevel(habit.current_streak);
  const next = nextHabitLevel(habit.current_streak);
  const progress = next
    ? Math.min(100, Math.round(((habit.current_streak - level.min_streak) / (next.min_streak - level.min_streak)) * 100))
    : 100;

  const handleLog = async () => {
    if (doneToday || busy) return;
    setBusy(true);
    hapticImpact("medium");
    try {
      await onLog();
      hapticNotification("success");
    } catch (e: any) {
      if (e?.message !== "already_logged") toast.error(e?.message ?? "Couldn't log.");
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm(`Archive "${protocol.title}"? You can add it back from the library.`)) return;
    try { await onArchive(); toast.success("Archived"); } catch { toast.error("Couldn't archive."); }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card/60 p-3.5 transition-colors",
        pillar.tint.border,
      )}
    >
      <div
        aria-hidden
        className={cn("absolute inset-0 bg-gradient-to-r pointer-events-none opacity-50", pillar.tint.glow)}
      />
      <div className="relative">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={handleLog}
            disabled={doneToday || busy}
            aria-label={doneToday ? "Logged today" : "Log today"}
            className={cn(
              "shrink-0 h-11 w-11 rounded-full border-2 flex items-center justify-center transition-all",
              doneToday
                ? "bg-emerald-500/25 border-emerald-400/60 text-emerald-300"
                : "bg-background/70 border-border/60 hover:border-gold/60 hover:bg-gold/10 active:scale-95",
            )}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : doneToday ? <Check size={18} strokeWidth={3} /> : <span className="text-lg">{pillar.emoji}</span>}
          </button>

          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left active:opacity-80"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={cn("text-[9px] font-black uppercase tracking-[0.18em]", pillar.tint.text)}>
                {pillar.name}
              </span>
              <EvidenceChip evidence={protocol.evidence} />
            </div>
            <p className={cn("font-bold text-[14px] leading-tight", doneToday && "line-through opacity-70")}>
              {protocol.title}
            </p>
            <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">
              {protocol.dose.summary}
            </p>
          </button>

          <button
            type="button"
            onClick={handleArchive}
            aria-label="Archive habit"
            className="shrink-0 h-7 w-7 rounded-full text-muted-foreground/50 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center"
          >
            <X size={13} />
          </button>
        </div>

        {/* Level + streak */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <Flame size={12} className="text-gold" />
            <span className="text-[11px] font-black tabular-nums">{habit.current_streak}d</span>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">streak</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className={cn("text-[10px] font-black tracking-widest uppercase", pillar.tint.text)}>
                Lv {level.level} · {level.name}
              </span>
              <span className="text-[9px] text-muted-foreground tabular-nums">
                {next ? `${habit.current_streak}/${next.min_streak}d` : "MAX"}
              </span>
            </div>
            <div className="h-1 rounded-full bg-background/60 overflow-hidden border border-border/30">
              <motion.div
                className="h-full bg-gradient-to-r from-[hsl(42_88%_62%)] to-[hsl(42_78%_48%)]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HabitCard;
