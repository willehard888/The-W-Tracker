import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTodayReflection } from "@/hooks/use-coach-reflection";
import { useRecentCheckins } from "@/hooks/use-recent-checkins";
import { PILLARS } from "@/lib/wellness-framework";
import { findWeakestPillarSmart } from "@/lib/coach/pick-free-move";

/**
 * Your read: where you are right now, from the last 7 days of check-ins.
 * One headline (the weakest signal), the signals inline, and the weakest
 * pillar as a hairline row that opens the chat with a concrete ask.
 */
const StateCard = ({ onAsk }: { onAsk?: (prompt: string) => void }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { reflection } = useTodayReflection();
  const { data: recent } = useRecentCheckins(7);

  const signal = useMemo(() => {
    if (!recent || recent.length === 0) {
      return {
        headline: "No check-ins yet — your first one starts the read",
        detail: "Tap the Check-in tab below.",
        sleepAvg: null as number | null,
        hydrationAvg: null as number | null,
      };
    }
    const sleepAvg = recent.reduce((s, r) => s + r.sleep_hours, 0) / recent.length;
    const hydroAvg = recent.reduce((s, r) => s + r.hydration_liters, 0) / recent.length;
    const meditationDays = recent.filter((r) => r.meditation_morning || r.meditation_evening).length;

    // Headline picks the weakest signal so the user knows where to push.
    // "Foundation looks clean" only fires if every input is in the green zone.
    let headline: string;
    if (sleepAvg < 7) {
      headline = `Slept ${sleepAvg.toFixed(1)}h avg — sleep is dragging recovery down`;
    } else if (hydroAvg < 2) {
      headline = `${hydroAvg.toFixed(1)}L water avg — hydration is light`;
    } else if (meditationDays < 2) {
      headline = `Mindfulness barely registered this week — easy win`;
    } else {
      headline = "Foundation looks clean. Stack the next lever.";
    }
    return { headline, detail: null, sleepAvg, hydrationAvg: hydroAvg };
  }, [recent]);

  const weakestPillar = useMemo(() => {
    // Build signals from recent check-ins so the picker uses real behaviour,
    // not just "which pillar do you have fewest habits in." A first-time
    // user with sub-7h sleep should see Sleep as weakest — not whatever the
    // canonical-first pillar happens to be.
    const signals = recent && recent.length > 0 ? {
      sleepAvg: recent.reduce((s, r) => s + r.sleep_hours, 0) / recent.length,
      hydrationAvg: recent.reduce((s, r) => s + r.hydration_liters, 0) / recent.length,
      workoutDays: recent.filter((r) => r.workout).length,
      meditationDays: recent.filter((r) => r.meditation_morning || r.meditation_evening).length,
    } : undefined;
    // Protocol-habit adoption no longer exists (habits live in the check-in),
    // so the pillar read comes purely from the last 7 days of signals.
    return findWeakestPillarSmart([], signals);
  }, [recent]);
  const pillarMeta = PILLARS[weakestPillar];

  return (
    <div className="surface-card surface-card-quiet p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] font-bold leading-snug text-foreground">{signal.headline}</p>
        {profile?.streak && profile.streak > 0 ? (
          <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">{profile.streak}d streak</span>
        ) : null}
      </div>
      {signal.detail && (
        <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{signal.detail}</p>
      )}

      {/* Signals inline: one quiet line, no tiles. */}
      {(signal.sleepAvg !== null || signal.hydrationAvg !== null) && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted-foreground tabular-nums">
          <span>Sleep <b className={cn("font-black", signal.sleepAvg !== null && signal.sleepAvg >= 7.5 ? "text-foreground" : "text-foreground/70")}>{signal.sleepAvg !== null ? `${signal.sleepAvg.toFixed(1)}h` : "—"}</b></span>
          <span>Water <b className={cn("font-black", signal.hydrationAvg !== null && signal.hydrationAvg >= 2.5 ? "text-foreground" : "text-foreground/70")}>{signal.hydrationAvg !== null ? `${signal.hydrationAvg.toFixed(1)}L` : "—"}</b></span>
          <span>Reflection <b className={cn("font-black", reflection ? "text-foreground" : "text-foreground/70")}>{reflection ? "logged" : "not yet"}</b></span>
        </p>
      )}

      {/* Weakest pillar: a hairline row that opens the chat with a concrete ask. */}
      <button
        type="button"
        onClick={() => onAsk ? onAsk(`Help me improve my ${pillarMeta.name.toLowerCase()} this week — one concrete change.`) : navigate("/coach")}
        className="press mt-3 pt-3 w-full min-h-11 border-t border-border/35 flex items-center gap-3 text-left"
      >
        <span className="text-lg shrink-0" aria-hidden>{pillarMeta.emoji}</span>
        <span className="flex-1 min-w-0">
          <span className={cn("block text-[13px] font-bold leading-tight", pillarMeta.tint.text)}>{pillarMeta.name} is the gap</span>
          <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-1">{pillarMeta.blurb}</span>
        </span>
        <ChevronRight size={16} className="text-muted-foreground/60 shrink-0" aria-hidden />
      </button>
    </div>
  );
};

export default StateCard;
