import { X, Shield, Flame, CalendarCheck } from "lucide-react";
import { useEffect } from "react";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/components/onboarding/onboarding-context";

interface ShieldEarnedSheetProps {
  /** Shields banked after this grant (server truth, 1..3). */
  shieldsBanked: number;
  onClose: () => void;
}

/**
 * Shown the moment a streak shield is EARNED (every 7-day streak, max 3
 * banked). Replaces the 4-second toast the founder kept missing — earning a
 * shield is rare and meaningful, so it gets a real explanation: where it came
 * from and exactly what it does.
 */
const ShieldEarnedSheet = ({ shieldsBanked, onClose }: ShieldEarnedSheetProps) => {
  // Contextual onboarding bookkeeping only — this sheet already teaches the
  // shield concept; the registry just records that the moment happened.
  const onboarding = useOnboarding();
  useEffect(() => {
    onboarding?.requestShow("STREAK_SHIELD_INTRO");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
  <Portal>
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in" />
      <div className="relative w-full max-w-md rounded-t-3xl border-t border-border bg-card shadow-2xl animate-in slide-in-from-bottom-8 duration-300 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="flex justify-center pt-2.5 pb-1"><div className="h-1 w-10 rounded-full bg-white/15" /></div>
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 h-9 w-9 flex items-center justify-center rounded-full bg-secondary/70 text-muted-foreground active:scale-90 transition-transform"><X aria-hidden size={16} /></button>

        <div className="px-6 pt-4 text-center">
          {/* Hero shield */}
          <div className="relative mx-auto mb-4 h-20 w-20">
            <div className="absolute inset-0 -m-3 rounded-full bg-gold/20 blur-2xl" aria-hidden />
            <div className="relative h-20 w-20 rounded-full bg-gold/12 border border-gold/45 flex items-center justify-center shadow-[0_0_32px_-6px_hsl(var(--gold)/0.6)]">
              <Shield aria-hidden size={36} className="text-gold" fill="currentColor" fillOpacity={0.25} />
            </div>
          </div>

          <h2 className="font-display text-2xl font-black tracking-tight">Streak Shield earned</h2>
          <p className="text-sm text-muted-foreground mt-1 tabular-nums">
            {shieldsBanked}/3 banked — your streak just got insurance.
          </p>
        </div>

        <div className="px-6 mt-5 space-y-2.5">
          {[
            { icon: CalendarCheck, text: "Every 7-day streak earns you one shield." },
            { icon: Flame, text: "Miss a day? A shield is spent instead of your streak — the fire keeps burning." },
            { icon: Shield, text: "Fully automatic. You can hold up to 3 at a time." },
          ].map((row, i) => (
            <div key={i} className="surface-card flex items-center gap-3 p-3.5 text-left">
              <span className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                <row.icon size={16} className="text-gold" />
              </span>
              <p className="text-[13px] leading-snug text-foreground/90">{row.text}</p>
            </div>
          ))}
        </div>

        <div className="px-6 mt-5">
          <Button variant="ember" size="lg" className="w-full" onClick={onClose}>Got it</Button>
        </div>
      </div>
    </div>
  </Portal>
  );
};

export default ShieldEarnedSheet;
