import { useNavigate } from "react-router-dom";
import { Dumbbell, Moon, Flame, Brain, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLifeOSBrief } from "@/hooks/use-life-os-brief";

/**
 * LifeOSCompactCard — the home-page CoachStrip variant of `LifeOSCard`.
 *
 * Renders today's holistic 5-domain Life OS brief (Body · Recovery · Fuel ·
 * Mind · Adjustment) in a snap-strip tile that fits the existing
 * `cardBase` width in `CoachStrip`. Tapping deep-links to `/coach` for the
 * full view.
 *
 * Hard constraints (per the perf-first home-page rebuild that landed in
 * `faf123a`):
 *   - No `framer-motion`, no continuous animations, no SVG turbulence.
 *   - No `useEffect`, no `useRef`, no `useState` — pure read of the hook.
 *   - Cache-first: `useLifeOSBrief` has a 23 h `staleTime`, so surfacing
 *     this on every home view costs ZERO extra AI invocations beyond the
 *     existing 1-per-user-per-day cap.
 *
 * Render contract:
 *   - When NO brief exists for today (e.g. brand-new user who hasn't
 *     opened /coach yet), this component renders `null` — `CoachStrip`'s
 *     existing "Ask your coach" tile is the lead. We deliberately do NOT
 *     auto-generate from here; surfacing on home should never trigger a
 *     fresh AI call without an explicit user gesture.
 *   - Once `/coach` has generated today's brief (or `coach-morning-nudge`
 *     populates it), this tile becomes the CoachStrip lead.
 *
 * Width matches CoachStrip's `cardBase` so the strip's snap-scrolling
 * stays consistent across tiles.
 */

const ADJ_TONE: Record<string, { label: string; cls: string }> = {
  push:   { label: "PUSH",   cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  hold:   { label: "HOLD",   cls: "text-gold       bg-gold/10        border-gold/30"         },
  deload: { label: "DELOAD", cls: "text-amber-400  bg-amber-400/10   border-amber-400/30"    },
  swap:   { label: "SWAP",   cls: "text-rose-400   bg-rose-400/10    border-rose-400/30"     },
};

interface LifeOSCompactCardProps {
  className?: string;
}

const LifeOSCompactCard = ({ className }: LifeOSCompactCardProps) => {
  const navigate = useNavigate();
  const { brief, isLoading } = useLifeOSBrief();

  // No brief yet today (and we're not in the loading window) → render
  // nothing; `CoachStrip` shows its existing tiles instead.
  if (isLoading || !brief) return null;

  const adj = brief.adjustment;
  const adjTone = ADJ_TONE[adj?.label] ?? ADJ_TONE.hold;

  return (
    <button
      type="button"
      onClick={() => navigate("/coach")}
      className={cn(
        "snap-start shrink-0 w-[88%] sm:w-[64%] md:w-[48%] rounded-2xl p-4 text-left",
        "active:scale-[0.99] transition-transform overflow-hidden relative",
        "border border-gold/35 shadow-[0_18px_48px_-24px_hsl(42_78%_54%/0.45)]",
        className,
      )}
      style={{
        background:
          "radial-gradient(120% 80% at 0% 0%, hsl(42 78% 54% / 0.16), transparent 55%), hsl(255 14% 7%)",
      }}
      aria-label="Open today's Life OS plan in W Coach"
    >
      {/* Header — eyebrow + adjustment chip */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles size={11} className="text-gold shrink-0" aria-hidden />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold truncate">
            Today · Life OS
          </p>
        </div>
        {adj?.label && (
          <span
            className={cn(
              "shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border",
              adjTone.cls,
            )}
          >
            {adjTone.label}
          </span>
        )}
      </div>

      {/* Today's focus headline */}
      <p className="text-[15px] font-bold text-foreground leading-tight line-clamp-2 mb-3">
        {brief.focus}
      </p>

      {/* 5-domain compact grid — icon + one-line action only.
          Detail copy lives in the full LifeOSCard (/coach). */}
      <div className="grid grid-cols-2 gap-1.5">
        <Domain icon={<Dumbbell size={10} />} label="Body" action={brief.body.action} />
        <Domain icon={<Moon     size={10} />} label="Recovery" action={brief.recovery.action} />
        <Domain icon={<Flame    size={10} />} label="Fuel" action={brief.fuel.action} />
        <Domain icon={<Brain    size={10} />} label="Mind" action={brief.mind.action} />
      </div>

      {/* Footer — readiness % from the adjustment object */}
      {typeof adj?.readiness === "number" && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
          <Zap size={10} className="text-gold/80" aria-hidden />
          <span className="font-bold">Readiness</span>
          <span className="font-black tabular-nums text-foreground">{adj.readiness}%</span>
        </div>
      )}
    </button>
  );
};

// One row of the 5-domain grid. Compact: icon + label + one-line action.
const Domain = ({
  icon,
  label,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  action: string;
}) => (
  <div className="flex flex-col gap-0.5 min-w-0">
    <div className="flex items-center gap-1 text-muted-foreground/80">
      <span className="text-gold/80 shrink-0">{icon}</span>
      <p className="text-[8.5px] font-black uppercase tracking-[0.18em]">{label}</p>
    </div>
    <p className="text-[11px] text-foreground/90 leading-tight line-clamp-2">{action}</p>
  </div>
);

export default LifeOSCompactCard;
