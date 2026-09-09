import { Shield, Flame, CalendarCheck } from "lucide-react";
import { useEffect } from "react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/components/onboarding/onboarding-context";

interface ShieldEarnedSheetProps {
  /** Shields banked after this grant (server truth, 1..3). */
  shieldsBanked: number;
  onClose: () => void;
}

const ROWS = [
  { icon: CalendarCheck, text: "Every 7-day streak earns you one shield." },
  { icon: Flame, text: "Miss a day? A shield is spent instead of your streak — the fire keeps burning." },
  { icon: Shield, text: "Fully automatic. You can hold up to 3 at a time." },
];

/**
 * Shown the moment a streak shield is EARNED (every 7-day streak, max 3
 * banked). Replaces the 4-second toast the founder kept missing — earning a
 * shield is rare and meaningful, so it gets a real explanation: where it came
 * from and exactly what it does. The shell is BottomSheet's.
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
    <BottomSheet open onClose={onClose} label="Streak shield earned" bodyClassName="px-6">
      <div className="pt-4 text-center">
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

      <ul className="mt-5 divide-y divide-border/35">
        {ROWS.map((row, i) => (
          <li key={i} className="flex items-center gap-3 py-3 text-left">
            <row.icon size={16} className="text-gold shrink-0" aria-hidden />
            <p className="text-[13px] leading-snug text-foreground/90">{row.text}</p>
          </li>
        ))}
      </ul>

      <Button variant="ember" size="lg" className="w-full mt-4" onClick={onClose}>Got it</Button>
    </BottomSheet>
  );
};

export default ShieldEarnedSheet;
