import { motion } from "framer-motion";
import { Zap, Flame, Trophy, TrendingUp, Crown, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeadToHeadProps {
  me: { username: string; xp: number; streak: number; level: number; rank_score: number };
  them: { username: string; xp: number; streak: number; level: number; rank_score: number };
}

/** Tug-of-war bar: leader's side fills proportionally. */
const VersusBar = ({
  mine,
  theirs,
  meColor,
  themColor,
}: {
  mine: number;
  theirs: number;
  meColor: string;
  themColor: string;
}) => {
  const total = Math.max(1, mine + theirs);
  const myPct = (mine / total) * 100;
  return (
    <div className="relative h-[3px] w-full rounded-full bg-border/30 overflow-hidden">
      {/* Mine — fills from LEFT */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${myPct}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: `linear-gradient(to right, ${meColor}aa, ${meColor})` }}
      />
      {/* Center pivot dot */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-background ring-1 ring-border/60 z-10"
        style={{ left: `${myPct}%` }}
      />
    </div>
  );
};

const DeltaPill = ({
  delta,
  suffix = "",
  meWins,
}: {
  delta: number;
  suffix?: string;
  meWins: boolean;
}) => {
  const tied = delta === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-[3px] rounded-full text-[9px] font-black tabular-nums border leading-none",
        tied && "text-muted-foreground border-border bg-secondary/30",
        !tied && meWins && "text-xp-green border-xp-green/40 bg-xp-green/10 shadow-[0_0_8px_-2px_hsl(152_68%_45%/0.4)]",
        !tied && !meWins && "text-rose-300 border-rose-500/40 bg-rose-500/10",
      )}
    >
      {!tied && (meWins ? "+" : "−")}
      {Math.abs(delta).toLocaleString()}
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
  const delta = mine - theirs; // ← FIX: positive when YOU lead
  const meWins = delta > 0;
  const themWins = delta < 0;

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-2">
        {/* Label column */}
        <div className="flex items-center gap-1.5 w-[70px] shrink-0">
          <Icon size={11} className={color} />
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            {label}
          </span>
        </div>

        {/* My value */}
        <div className="flex-1 flex items-center justify-end gap-1.5">
          {meWins && <Crown size={10} className="text-gold drop-shadow-[0_0_4px_hsl(42_100%_55%/0.6)]" />}
          <span
            className={cn(
              "font-display font-black text-[15px] tabular-nums tracking-tight",
              meWins && "text-foreground",
              themWins && "text-muted-foreground/45",
              !meWins && !themWins && "text-foreground/80",
            )}
          >
            {format(mine)}{suffix}
          </span>
        </div>

        {/* Delta */}
        <div className="shrink-0 w-[68px] flex justify-center">
          <DeltaPill delta={delta} suffix={suffix} meWins={meWins} />
        </div>

        {/* Their value */}
        <div className="flex-1 flex items-center gap-1.5">
          <span
            className={cn(
              "font-display font-black text-[15px] tabular-nums tracking-tight",
              themWins && "text-gold",
              meWins && "text-muted-foreground/45",
              !meWins && !themWins && "text-foreground/80",
            )}
          >
            {format(theirs)}{suffix}
          </span>
          {themWins && <Crown size={10} className="text-gold drop-shadow-[0_0_4px_hsl(42_100%_55%/0.6)]" />}
        </div>
      </div>

      {/* Tug-of-war bar */}
      <div className="mt-2 px-[72px]">
        <VersusBar
          mine={mine}
          theirs={theirs}
          meColor="hsl(var(--gold))"
          themColor="hsl(var(--muted-foreground))"
        />
      </div>
    </div>
  );
};

const HeadToHead = ({ me, them }: HeadToHeadProps) => {
  // Calculate overall lead score (1 point per stat won)
  const stats = [
    me.xp - them.xp,
    me.level - them.level,
    me.streak - them.streak,
    me.rank_score - them.rank_score,
  ];
  const wins = stats.filter((d) => d > 0).length;
  const losses = stats.filter((d) => d < 0).length;
  const overallLead = wins > losses ? "me" : losses > wins ? "them" : "tie";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="relative rounded-2xl border border-gold/25 p-4 mb-4 overflow-hidden
                 bg-[radial-gradient(ellipse_at_top,_hsl(var(--gold)/0.08)_0%,_hsl(var(--card)/0.7)_45%,_hsl(var(--card)/0.4)_100%)]
                 shadow-[inset_0_1px_0_hsl(var(--gold)/0.12),0_8px_24px_-12px_hsl(var(--gold)/0.25)]"
    >
      {/* Top accent line */}
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      {/* Corner glow */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gold/[0.06] blur-2xl" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-1.5">
          <Swords size={11} className="text-gold/80" />
          <p className="text-[10px] uppercase tracking-[0.28em] font-black text-gold/80">
            Head to Head
          </p>
        </div>
        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-xp-green/70 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-xp-green" />
          </span>
          Live
        </span>
      </div>

      {/* Players */}
      <div className="flex items-center justify-between gap-2 mb-4 relative">
        <div className="flex-1 text-right min-w-0">
          <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70 font-bold mb-0.5">
            You
          </p>
          <p
            className={cn(
              "font-display font-black text-[15px] truncate",
              overallLead === "me" && "text-foreground",
              overallLead === "them" && "text-muted-foreground/70",
            )}
          >
            @{me.username}
          </p>
        </div>

        {/* VS medallion */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-gold/30 blur-md animate-pulse" />
          <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-gold via-gold/90 to-amber-700 flex items-center justify-center shadow-[0_2px_8px_-2px_hsl(42_100%_55%/0.6),inset_0_1px_0_hsl(48_100%_70%/0.6)] ring-1 ring-gold/60">
            <span className="font-display font-black text-[10px] text-background tracking-wider">
              VS
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70 font-bold mb-0.5">
            Them
          </p>
          <p
            className={cn(
              "font-display font-black text-[15px] truncate",
              overallLead === "them" && "text-gold",
              overallLead === "me" && "text-muted-foreground/70",
            )}
          >
            @{them.username}
          </p>
        </div>
      </div>

      {/* Score summary banner */}
      {overallLead !== "tie" && (
        <div className="mb-2 -mx-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-transparent via-gold/[0.06] to-transparent border-y border-gold/10">
          <p className="text-[9px] uppercase tracking-[0.22em] font-black text-center text-gold/80">
            {overallLead === "me" ? "You lead" : "They lead"} {Math.max(wins, losses)}–{Math.min(wins, losses)}
          </p>
        </div>
      )}

      {/* Stat rows */}
      <div className="divide-y divide-border/30">
        <Row icon={Zap} label="XP" mine={me.xp} theirs={them.xp} color="text-gold" />
        <Row icon={TrendingUp} label="Level" mine={me.level} theirs={them.level} color="text-gold" />
        <Row icon={Flame} label="Streak" mine={me.streak} theirs={them.streak} color="text-[hsl(14_95%_55%)]" suffix="d" />
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
