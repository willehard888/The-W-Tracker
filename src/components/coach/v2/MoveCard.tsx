import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Check, ArrowRight, Plus, Sparkles, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserHabits } from "@/hooks/use-user-habits";
import { PROTOCOLS, type Protocol } from "@/lib/wellness-framework";
import { pickFreeTierMove } from "@/lib/coach/pick-free-move";
import EvidenceChip from "@/components/coach/EvidenceChip";
import ProtocolSheet from "@/components/coach/ProtocolSheet";
import { hapticImpact } from "@/lib/haptics";

/**
 * Card 2 — Liike (Move).
 *
 * Answers "What's the highest-leverage action today?":
 *  - Free tier: 1 rule-based PROTOCOLS suggestion (no AI, no failure mode)
 *  - Elite: same rule-based pick PLUS the user's habits inline for one-tap log
 *
 * Why no AI on Elite either (v1): the previous coach-daily-plan endpoint
 * was producing "Couldn't generate brief" errors due to OPENROUTER plumbing.
 * We ship the deterministic version first so the card always works, then
 * layer AI plan generation on top in a follow-up commit once the OpenRouter
 * key is verified on the destination project.
 */
const MoveCard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { habits, completedTodaySet, logHabit } = useUserHabits();
  const [openProtocol, setOpenProtocol] = useState<Protocol | null>(null);

  const picked = useMemo(
    () => pickFreeTierMove({
      activeProtocolIds: habits.map((h) => h.protocol_id),
      now: new Date(),
    }),
    [habits],
  );

  // ── Accountability loop ──────────────────────────────────────────────
  // The Coach closes the loop on what the user committed to. Two cases, in
  // priority order:
  //  1. Streak at risk: a live streak (≥2d) logged yesterday but not yet today
  //     → "don't break the chain" nudge.
  //  2. Lapsed: a habit that once hit a real streak (best ≥3) but slipped
  //     → "restart the chain" nudge.
  // One nudge max, the highest-leverage one, with a one-tap log.
  const accountability = useMemo(() => {
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    const yesterday = fmt(new Date(now.getTime() - 86_400_000));
    const pending = habits.filter((h) => !completedTodaySet.has(h.id));

    const atRisk = pending
      .filter((h) => h.last_logged_on === yesterday && h.current_streak >= 2)
      .sort((a, b) => b.current_streak - a.current_streak)[0];
    if (atRisk) {
      const title = PROTOCOLS.find((p) => p.id === atRisk.protocol_id)?.title ?? atRisk.protocol_id;
      return {
        habit: atRisk,
        kind: "risk" as const,
        title,
        message: `${atRisk.current_streak}-day streak on ${title} — log today so you don't break the chain.`,
      };
    }

    const lapsed = pending
      .filter((h) => h.last_logged_on && h.last_logged_on < yesterday && h.best_streak >= 3)
      .sort((a, b) => b.best_streak - a.best_streak)[0];
    if (lapsed) {
      const title = PROTOCOLS.find((p) => p.id === lapsed.protocol_id)?.title ?? lapsed.protocol_id;
      return {
        habit: lapsed,
        kind: "lapsed" as const,
        title,
        message: `You hit ${lapsed.best_streak} days on ${title} before. Restart the chain today.`,
      };
    }

    return null;
  }, [habits, completedTodaySet]);

  const logHabitWithToast = async (id: string) => {
    try {
      hapticImpact("light");
      const r = await logHabit(id);
      toast.success(`+${r.xp_awarded} XP`, {
        description: `Lv ${r.level} · ${r.streak}d streak`,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't log habit");
    }
  };

  return (
    <div className="rounded-3xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card p-5 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)]">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={12} className="text-gold" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85">
          Liike — today's move
        </p>
      </div>

      {/* Accountability nudge — the Coach follows up on a streak at risk or a
          lapsed habit, with a one-tap log to close the loop immediately. */}
      {accountability && (
        <button
          type="button"
          onClick={() => logHabitWithToast(accountability.habit.id)}
          className={cn(
            "w-full text-left rounded-2xl border p-3.5 mb-3 active:scale-[0.99] transition-colors",
            accountability.kind === "risk"
              ? "border-[hsl(var(--streak-orange))]/45 bg-[hsl(var(--streak-orange))]/[0.08] hover:bg-[hsl(var(--streak-orange))]/[0.12]"
              : "border-gold/35 bg-gold/[0.05] hover:bg-gold/[0.08]",
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
              accountability.kind === "risk" ? "bg-[hsl(var(--streak-orange))]/20" : "bg-gold/15",
            )}>
              <Flame
                size={16}
                className={accountability.kind === "risk" ? "text-[hsl(var(--streak-orange))]" : "text-gold"}
                strokeWidth={2.6}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-0.5">
                {accountability.kind === "risk" ? "Keep your streak" : "Restart your streak"}
              </p>
              <p className="text-[12.5px] font-semibold leading-snug text-foreground">
                {accountability.message}
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gold">
              Log <Check size={11} />
            </span>
          </div>
        </button>
      )}

      {/* Suggested protocol — picked from PROTOCOLS by pillar + time of day */}
      {picked && (
        <button
          type="button"
          onClick={() => setOpenProtocol(picked.protocol)}
          className="w-full text-left rounded-2xl border border-gold/35 bg-gold/[0.05] p-4 hover:bg-gold/[0.08] transition-colors active:scale-[0.99]"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <EvidenceChip evidence={picked.protocol.evidence} />
            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
              {picked.protocol.pillar}
            </span>
          </div>
          <p className="text-[15px] font-bold leading-tight text-foreground mb-1">
            {picked.protocol.title}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {picked.protocol.dose.summary}
          </p>
          <p className="text-[10.5px] text-gold/85 leading-snug mt-2 italic">
            {picked.reason}
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-gold">
            Read & adopt <ArrowRight size={10} />
          </div>
        </button>
      )}

      {/* User's active habits — inline one-tap logging */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
            Your habits today
          </p>
          {habits.length > 0 && (
            <button
              onClick={() => navigate("/coach/habits")}
              className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-gold transition-colors"
            >
              Manage
            </button>
          )}
        </div>

        {habits.length === 0 ? (
          <button
            onClick={() => navigate("/coach/library")}
            className="w-full flex items-center gap-2.5 rounded-xl border border-dashed border-gold/30 px-3 py-2.5 hover:bg-gold/[0.04] transition-colors text-left"
          >
            <div className="h-7 w-7 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <Plus size={14} className="text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold">Pick your first habit</p>
              <p className="text-[10px] text-muted-foreground">
                Browse the protocol library — tap one to add it.
              </p>
            </div>
          </button>
        ) : (
          <div className="space-y-1.5">
            {habits.map((h) => {
              const protocol = PROTOCOLS.find((p) => p.id === h.protocol_id);
              const title = protocol?.title ?? h.protocol_id;
              const done = completedTodaySet.has(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  disabled={done}
                  onClick={() => logHabitWithToast(h.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors text-left active:scale-[0.98]",
                    done
                      ? "border-gold/30 bg-gold/[0.08] cursor-default"
                      : "border-border/45 bg-card/50 hover:bg-card/80",
                  )}
                >
                  <div className={cn(
                    "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
                    done ? "bg-gold/20 text-gold" : "bg-card text-muted-foreground border border-border/40",
                  )}>
                    {done ? <Check size={12} /> : <Sparkles size={11} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[12.5px] font-semibold truncate", done && "text-gold")}>
                      {title}
                    </p>
                    <p className="text-[9.5px] text-muted-foreground">
                      {done ? `Done · ${h.current_streak}d streak` : `${h.current_streak}d streak · Lv ${h.level}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ProtocolSheet
        protocol={openProtocol}
        open={!!openProtocol}
        onOpenChange={(v) => !v && setOpenProtocol(null)}
      />
    </div>
  );
};

export default MoveCard;
