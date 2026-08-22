import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";

interface HonestyGateProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

/**
 * The one true gate — a single affirmative checkbox right above the submit
 * button. Replaces the "Were you honest? Yes ✅ / No ❌ → go fix your answers"
 * dead-end that sat 1000px above a greyed button.
 */
const HonestyGate = ({ checked, onChange }: HonestyGateProps) => (
  <button
    type="button"
    onClick={() => { hapticSelection(); onChange(!checked); }}
    aria-pressed={checked}
    className={cn(
      "w-full flex items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.99]",
      checked ? "border-gold/45 bg-gradient-to-b from-gold/[0.08] to-transparent" : "border-border bg-card",
    )}
  >
    <span className={cn(
      "h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
      checked ? "border-gold bg-gold shadow-[0_0_10px_-1px_hsl(var(--gold)/0.6)]" : "border-muted-foreground/40",
    )}>
      {checked && <Check size={14} className="text-primary-foreground" strokeWidth={3} />}
    </span>
    <span className="min-w-0">
      <span className="block font-bold text-[15px]">Honest log <span className="text-muted-foreground font-semibold text-xs">· required</span></span>
      <span className="block text-xs text-muted-foreground mt-0.5">XP only means something if it's true.</span>
    </span>
  </button>
);

export default HonestyGate;
