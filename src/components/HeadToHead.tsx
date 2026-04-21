import { motion } from "framer-motion";
import { Zap, Flame, Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeadToHeadProps {
  me: { username: string; xp: number; streak: number; level: number; rank_score: number };
  them: { username: string; xp: number; streak: number; level: number; rank_score: number };
}

const DeltaPill = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const positive = value > 0;
  const negative = value < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black tabular-nums border",
        positive && "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
        negative && "text-red-400 border-red-500/30 bg-red-500/5",
        !positive && !negative && "text-muted-foreground border-border bg-secondary/30",
      )}
    >
      <Icon size={8} />
      {positive && "+"}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
};

const Row = ({
  icon: Icon,
  label,
  mine,
  theirs,
  color,
  format = (v: number) => v.toLocaleString(),
  suffix = "",
}: {
  icon: any;
  label: string;
  mine: number;
  theirs: number;
  color: string;
  format?: (v: number) => string;
  suffix?: string;
}) => {
  const delta = theirs - mine;
  const theyLead = delta > 0;
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex items-center gap-1.5 w-[72px] shrink-0">
        <Icon size={11} className={color} />
        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 flex items-center justify-between gap-2">
        <span className={cn("font-display font-black text-sm tabular-nums text-right flex-1", !theyLead && "text-foreground", theyLead && "text-muted-foreground/60")}>
          {format(mine)}{suffix}
        </span>
        <DeltaPill value={delta} suffix={suffix} />
        <span className={cn("font-display font-black text-sm tabular-nums flex-1", theyLead && "text-gold", !theyLead && "text-muted-foreground/60")}>
          {format(theirs)}{suffix}
        </span>
      </div>
    </div>
  );
};

const HeadToHead = ({ me, them }: HeadToHeadProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.04] via-card/60 to-card/30 p-4 mb-4 overflow-hidden relative"
    >
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.28em] font-black text-gold/70">Head to Head</p>
        <span className="text-[9px] text-muted-foreground font-bold">live comparison</span>
      </div>

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex-1 text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-bold">You</p>
          <p className="font-display font-black text-sm truncate">@{me.username}</p>
        </div>
        <div className="h-8 w-8 rounded-full gradient-gold flex items-center justify-center shrink-0">
          <span className="font-display font-black text-[10px] text-primary-foreground">VS</span>
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-bold">Them</p>
          <p className="font-display font-black text-sm truncate text-gold">@{them.username}</p>
        </div>
      </div>

      <div className="divide-y divide-border/40">
        <Row icon={Zap} label="XP" mine={me.xp} theirs={them.xp} color="text-gold" />
        <Row icon={TrendingUp} label="Level" mine={me.level} theirs={them.level} color="text-gold" />
        <Row icon={Flame} label="Streak" mine={me.streak} theirs={them.streak} color="text-[hsl(18_95%_58%)]" suffix="d" />
        <Row
          icon={Trophy}
          label="Rank"
          mine={me.rank_score}
          theirs={them.rank_score}
          color="text-gold"
          format={(v) => v.toFixed(1)}
        />
      </div>
    </motion.div>
  );
};

export default HeadToHead;
