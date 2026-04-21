import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDailyPulse } from "@/hooks/use-daily-pulse";

interface DailyStatusPulseProps {
  userId: string;
  rank: number;
  score: number;
  totalUsers: number;
  className?: string;
}

const DailyStatusPulse = ({ userId, rank, score, totalUsers, className }: DailyStatusPulseProps) => {
  const navigate = useNavigate();
  const pulse = useDailyPulse(userId, rank, score, totalUsers);

  if (pulse.loading) return null;

  const up = pulse.rankDelta > 0;
  const down = pulse.rankDelta < 0;
  const flat = pulse.rankDelta === 0;

  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;

  const tone = up
    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/8"
    : down
    ? "text-destructive border-destructive/30 bg-destructive/8"
    : "text-muted-foreground border-border/40 bg-card/40";

  const label = !pulse.hasSnapshot
    ? "Tracking starts today"
    : up
    ? `+${Math.abs(pulse.rankDelta)} ranks today`
    : down
    ? `−${Math.abs(pulse.rankDelta)} ranks today`
    : "Holding position";

  return (
    <motion.button
      type="button"
      onClick={() => navigate("/leaderboard")}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "w-full rounded-xl border px-3 py-2 flex items-center gap-2.5 active:scale-[0.99] transition-transform",
        tone,
        className,
      )}
    >
      <Icon size={14} strokeWidth={2.75} className="shrink-0" />
      <p className="text-xs font-black uppercase tracking-wider truncate">{label}</p>
      <span className="ml-auto text-[10px] text-muted-foreground tabular-nums shrink-0">
        {pulse.usersBehind} behind
      </span>
    </motion.button>
  );
};

export default DailyStatusPulse;
