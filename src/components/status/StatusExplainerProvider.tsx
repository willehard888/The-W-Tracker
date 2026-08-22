import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { X, Flame, Zap, Gauge, Target, Trophy } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useMyRank } from "@/hooks/use-my-rank";
import { useNextTierProgress } from "@/hooks/use-next-tier-progress";
import { useRankBreakdown } from "@/hooks/use-rank-breakdown";
import { getTierConfig, topShareLabel, tierBandLabel, CONSISTENCY_WEIGHTS } from "@/lib/status-tiers";
import NextTierProgress from "@/components/status/NextTierProgress";
import TierLadderRows from "@/components/status/TierLadderRows";
import { track } from "@/lib/analytics";

interface Ctx {
  open: () => void;
  close: () => void;
}
const StatusExplainerContext = createContext<Ctx | null>(null);
export const useStatusExplainer = () => useContext(StatusExplainerContext);

/**
 * "How status works" — one sheet, the user's live numbers plugged in:
 *   Check in → XP & streak → Consistency (0–100) → Your place → Tier.
 * Mounted once (App); opened from Home, Ranks, Profile and /profile?tier=.
 */
export const StatusExplainerProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const value = useMemo<Ctx>(() => ({
    open: () => { setOpen(true); void track("status_explainer_opened"); },
    close: () => setOpen(false),
  }), []);
  return (
    <StatusExplainerContext.Provider value={value}>
      {children}
      {open && <StatusExplainerSheet onClose={value.close} />}
    </StatusExplainerContext.Provider>
  );
};

const Step = ({ n, icon: Icon, title, children }: { n: number; icon: typeof Flame; title: string; children: ReactNode }) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <span className="h-8 w-8 rounded-full bg-gold/12 border border-gold/35 text-gold flex items-center justify-center shrink-0"><Icon size={14} /></span>
      <span className="flex-1 w-px bg-border/50 mt-1" />
    </div>
    <div className="pb-5 min-w-0 flex-1">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">Step {n}</p>
      <p className="font-display font-black text-[15px] leading-tight mt-0.5">{title}</p>
      <div className="mt-1.5 text-xs text-muted-foreground leading-snug space-y-1">{children}</div>
    </div>
  </div>
);

const StatusExplainerSheet = ({ onClose }: { onClose: () => void }) => {
  const { profile } = useAuth();
  const tier = profile?.status_tier ?? "recruit";
  const cfg = getTierConfig(tier);
  const { data: rankData } = useMyRank(profile?.user_id);
  const progress = useNextTierProgress();
  const { data: bd } = useRankBreakdown(profile?.user_id);
  const ranked = rankData?.hasRank === true;
  const consistency = bd?.total ?? Number(profile?.rank_score ?? 0);

  const close = useCallback(() => onClose(), [onClose]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center">
        <button aria-label="Close" onClick={close} className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in" />
        <div className="relative w-full max-w-md max-h-[88dvh] flex flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
          <div className="flex justify-center pt-2.5 pb-1 shrink-0"><div className="h-1 w-10 rounded-full bg-white/15" /></div>
          <div className="px-5 pt-1 pb-3 border-b border-border/60 shrink-0 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-black tracking-tight">How status works</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Earned, never bought. Miss days and it falls.</p>
            </div>
            <button onClick={close} aria-label="Close" className="h-9 w-9 -mr-1 flex items-center justify-center rounded-full bg-secondary/70 text-muted-foreground active:scale-90 transition-transform"><X size={16} /></button>
          </div>

          <div className="overflow-y-auto px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            <Step n={1} icon={Flame} title="Check in daily">
              <p>Log your Core 4 every day — done or not. Logging is what keeps the streak.</p>
            </Step>
            <Step n={2} icon={Zap} title="XP & streak">
              <p><span className="text-foreground/90 font-bold tabular-nums">{(profile?.xp ?? 0).toLocaleString()} XP</span> · <span className="text-foreground/90 font-bold">{profile?.streak ?? 0}-day streak</span>{((profile?.streak_shields ?? 0) > 0) ? ` · ${profile.streak_shields} shield${profile.streak_shields === 1 ? "" : "s"}` : ""}</p>
              <p>What you did earns XP; consecutive days build the streak. A shield covers one missed day.</p>
            </Step>
            <Step n={3} icon={Gauge} title={`Consistency ${Math.round(consistency)} / 100`}>
              <p>Recomputed after every check-in. Three inputs:</p>
              <div className="mt-1.5 space-y-1">
                {CONSISTENCY_WEIGHTS.map((w) => {
                  const v = w.key === "activeDays" ? bd?.active_days_score : w.key === "dailyXp" ? bd?.xp_score : bd?.streak_score;
                  const extra = w.key === "activeDays" && bd ? ` · ${bd.active_days}/30 days` : "";
                  return (
                    <div key={w.key} className="flex items-center gap-2">
                      <span className="text-foreground/85 font-semibold">{w.label}{extra}</span>
                      <span className="ml-auto tabular-nums text-muted-foreground">{Math.round(w.weight * 100)}%{v != null ? ` · ${Math.round(v)}` : ""}</span>
                    </div>
                  );
                })}
              </div>
            </Step>
            <Step n={4} icon={Target} title="Your place">
              <p className="text-foreground/90 font-bold">
                {ranked ? `#${rankData!.rank!.toLocaleString()} of ${(rankData!.totalUsers ?? 0).toLocaleString()} ranked · ${topShareLabel(tier, rankData)}` : "Your first check-in puts you on the board."}
              </p>
              <p>Ranked by Consistency. Top % = the share of ranked members you're ahead of.</p>
            </Step>
            <Step n={5} icon={Trophy} title={`Tier: ${cfg.label} · ${tierBandLabel(tier)}`}>
              <p>Tiers are bands of Top % — or a consistency path (active days + streak) for the higher rungs.</p>
              <div className="mt-2"><NextTierProgress data={progress} /></div>
              <div className="mt-3"><TierLadderRows currentTier={tier} /></div>
            </Step>
            <Button variant="ember" size="lg" className={cn("w-full mt-2")} onClick={close}>Got it</Button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default StatusExplainerProvider;
