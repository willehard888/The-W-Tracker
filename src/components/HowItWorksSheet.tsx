import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X, Flame, Zap, Gauge, CalendarCheck, ChevronRight } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HOW_IT_WORKS_BEATS, type HowBeatKey } from "@/lib/how-it-works";
import { useStatusExplainer } from "@/components/status/StatusExplainerProvider";
import { track } from "@/lib/analytics";

interface Ctx {
  open: (beat?: HowBeatKey) => void;
  close: () => void;
}
const HowItWorksContext = createContext<Ctx | null>(null);
export const useHowItWorks = () => useContext(HowItWorksContext);

const ICONS: Record<HowBeatKey, typeof Flame> = {
  checkin: CalendarCheck,
  streak: Flame,
  xp: Zap,
  ladder: Gauge,
};

/**
 * "How The W works" — four beats, ~20 seconds, opened from every (i) in the
 * app (Home numbers row, Ranks header, check-in headers, Profile › Settings)
 * and once automatically for a user with no check-ins. The status explainer
 * (StatusExplainerProvider) is the deeper dive behind beat 4.
 */
export const HowItWorksProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<{ open: boolean; beat: HowBeatKey | null }>({ open: false, beat: null });
  const value = useMemo<Ctx>(() => ({
    open: (beat) => { setState({ open: true, beat: beat ?? null }); void track("how_it_works_opened", { beat: beat ?? "all" }); },
    close: () => setState((s) => ({ ...s, open: false })),
  }), []);
  return (
    <HowItWorksContext.Provider value={value}>
      {children}
      {state.open && <HowItWorksSheet focus={state.beat} onClose={value.close} />}
    </HowItWorksContext.Provider>
  );
};

const HowItWorksSheet = ({ focus, onClose }: { focus: HowBeatKey | null; onClose: () => void }) => {
  const explainer = useStatusExplainer();
  const close = useCallback(() => onClose(), [onClose]);
  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (focus && focusRef.current) focusRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center">
        <button aria-label="Close" onClick={close} className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in" />
        <div className="relative w-full max-w-md max-h-[88dvh] flex flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
          <div className="flex justify-center pt-2.5 pb-1 shrink-0"><div className="h-1 w-10 rounded-full bg-white/15" /></div>
          <div className="px-5 pt-1 pb-3 border-b border-border/60 shrink-0 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-black tracking-tight">How The W works</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Show up daily. Everything else follows.</p>
            </div>
            <button onClick={close} aria-label="Close" className="h-9 w-9 -mr-1 flex items-center justify-center rounded-full bg-secondary/70 text-muted-foreground active:scale-90 transition-transform"><X size={16} /></button>
          </div>

          <div className="overflow-y-auto px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)] space-y-2.5">
            {HOW_IT_WORKS_BEATS.map((b, i) => {
              const Icon = ICONS[b.key];
              const hot = focus === b.key;
              return (
                <div
                  key={b.key}
                  ref={hot ? focusRef : undefined}
                  className={cn("surface-card p-3.5 flex gap-3 transition-colors", hot && "border-gold/50 bg-gold/[0.06]")}
                >
                  <span className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-gold" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow">Step {i + 1}</p>
                    <p className="font-display font-black text-[15px] leading-tight mt-0.5">{b.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-1">{b.body}</p>
                    {b.key === "ladder" && explainer && (
                      <button
                        type="button"
                        onClick={() => { close(); explainer.open(); }}
                        className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-gold active:opacity-70"
                      >
                        See the ladder with your numbers <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <Button variant="ember" size="lg" className="w-full mt-3" onClick={close}>Got it</Button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default HowItWorksProvider;
