import { fmtInt } from "@/lib/format";
import StatusAvatar from "@/components/StatusAvatar";
import { cn } from "@/lib/utils";

interface Side {
  username: string;
  xp: number;
  streak: number;
  level: number;
  rank_score: number;
  avatarUrl?: string | null;
  tier?: string | null;
}

interface HeadToHeadProps {
  me: Side;
  them: Side;
}

const ROWS: { key: "xp" | "level" | "streak" | "rank_score"; label: string; format: (v: number) => string }[] = [
  { key: "xp", label: "XP", format: fmtInt },
  { key: "level", label: "Level", format: fmtInt },
  { key: "streak", label: "Streak", format: (v) => `${fmtInt(v)}d` },
  { key: "rank_score", label: "Consistency", format: (v) => v.toFixed(1) },
];

/**
 * You against them: two faces, one lead line, four scoreboard rows. The
 * side that wins a row is the only gold in it; the rest recedes.
 */
const HeadToHead = ({ me, them }: HeadToHeadProps) => {
  const deltas = ROWS.map((r) => me[r.key] - them[r.key]);
  const wins = deltas.filter((d) => d > 0).length;
  const losses = deltas.filter((d) => d < 0).length;
  const lead = wins > losses ? "me" : losses > wins ? "them" : "tie";
  const leadLine = lead === "me" ? `You lead ${wins} of ${ROWS.length}.` : lead === "them" ? `They lead ${losses} of ${ROWS.length}.` : "Even.";

  return (
    <section className="surface-card surface-card-quiet p-4" aria-label="Head to head">
      <div className="flex items-center gap-3">
        <StatusAvatar src={me.avatarUrl} name={me.username} tier={me.tier || "recruit"} size="md" animated={false} />
        <p className={cn("flex-1 min-w-0 font-display font-black text-[15px] truncate", lead === "me" ? "text-gold" : "text-foreground/85")}>
          @{me.username}
        </p>
        <span className="font-display font-black text-[11px] text-muted-foreground/70 shrink-0">VS</span>
        <p className={cn("flex-1 min-w-0 font-display font-black text-[15px] truncate text-right", lead === "them" ? "text-gold" : "text-foreground/85")}>
          @{them.username}
        </p>
        <StatusAvatar src={them.avatarUrl} name={them.username} tier={them.tier || "recruit"} size="md" animated={false} />
      </div>
      <p className="mt-2 text-center text-[11px] font-bold text-muted-foreground">{leadLine}</p>

      <div className="mt-3 divide-y divide-border/35 border-t border-border/35">
        {ROWS.map((r, i) => {
          const d = deltas[i];
          return (
            <div key={r.key} className="py-2.5 flex items-center gap-3">
              <span className={cn("flex-1 text-right font-display font-black text-[15px] tabular-nums tracking-tight", d > 0 ? "text-gold" : d < 0 ? "text-muted-foreground/60" : "text-foreground/80")}>
                {r.format(me[r.key])}
              </span>
              <span className="w-[5.5rem] shrink-0 text-center text-[11px] font-bold text-muted-foreground">{r.label}</span>
              <span className={cn("flex-1 text-left font-display font-black text-[15px] tabular-nums tracking-tight", d < 0 ? "text-gold" : d > 0 ? "text-muted-foreground/60" : "text-foreground/80")}>
                {r.format(them[r.key])}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default HeadToHead;
