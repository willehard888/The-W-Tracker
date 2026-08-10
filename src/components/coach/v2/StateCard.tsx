import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Moon, Droplets, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTodayReflection } from "@/hooks/use-coach-reflection";
import { useRecentCheckins } from "@/hooks/use-recent-checkins";
import { useUserHabits } from "@/hooks/use-user-habits";
import { PILLARS } from "@/lib/wellness-framework";
import { findWeakestPillarSmart } from "@/lib/coach/pick-free-move";

/**
 * Card 1 — Tila (State).
 *
 * Answers "Where am I right now?" with two layers:
 *   1) A signal row (mood/sleep/hydration trend over last 7d)
 *   2) A "weakest pillar" chip the user can tap to fill the gap
 *
 * Free + Elite both see the same card. Elite gets the same data; the
 * differentiator is downstream (the adaptive plan in TodaysPlanCard).
 */
const StateCard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { reflection } = useTodayReflection();
  const { data: recent } = useRecentCheckins(7);
  const { habits } = useUserHabits();

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
    return findWeakestPillarSmart(
      habits.map((h) => h.protocol_id),
      signals,
    );
  }, [habits, recent]);
  const pillarMeta = PILLARS[weakestPillar];

  return (
    <div className="rounded-3xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card p-5 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)]">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={12} className="text-gold" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85">
          Your read
        </p>
        {profile?.streak && profile.streak > 0 ? (
          <span className="ml-auto text-[10px] font-bold text-gold tabular-nums">
            {profile.streak}d streak
          </span>
        ) : null}
      </div>

      <p className="text-[14px] font-bold leading-snug text-foreground">
        {signal.headline}
      </p>
      {signal.detail && (
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
          {signal.detail}
        </p>
      )}

      {/* Signal row — sleep / hydration / reflection presence */}
      {(signal.sleepAvg !== null || signal.hydrationAvg !== null) && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <SignalTile
            icon={Moon}
            label="Sleep"
            value={signal.sleepAvg !== null ? `${signal.sleepAvg.toFixed(1)}h` : "—"}
            good={signal.sleepAvg !== null && signal.sleepAvg >= 7.5}
          />
          <SignalTile
            icon={Droplets}
            label="Water"
            value={signal.hydrationAvg !== null ? `${signal.hydrationAvg.toFixed(1)}L` : "—"}
            good={signal.hydrationAvg !== null && signal.hydrationAvg >= 2.5}
          />
          <SignalTile
            icon={Sparkles}
            label="Today"
            value={reflection ? "Logged" : "—"}
            good={!!reflection}
          />
        </div>
      )}

      {/* Weakest pillar chip — tap to fill the gap.
          Two-line layout: pillar name as the strong line, blurb as the
          subtle context line below it. Avoids the truncated "Sleep —
          Strongest single lever for e..." that looked broken. */}
      <button
        onClick={() => navigate(`/coach/library?pillar=${weakestPillar}`)}
        className={cn(
          "mt-4 w-full flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 transition-colors active:scale-[0.98]",
          pillarMeta.tint.border,
          "bg-card/40 hover:bg-card/70",
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="text-xl shrink-0">{pillarMeta.emoji}</span>
          <div className="text-left min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/85 mb-0.5">
              Weakest pillar
            </p>
            <p className={cn("text-[13px] font-bold leading-tight", pillarMeta.tint.text)}>
              {pillarMeta.name}
            </p>
            <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
              {pillarMeta.blurb}
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold text-gold/85 shrink-0">Fill →</span>
      </button>
    </div>
  );
};

const SignalTile = ({
  icon: Icon, label, value, good,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  good: boolean;
}) => (
  <div className={cn(
    "rounded-xl border px-3 py-2 flex flex-col items-start",
    good
      ? "border-gold/30 bg-gold/[0.05]"
      : "border-border/40 bg-card/40",
  )}>
    <div className="flex items-center gap-1 mb-0.5">
      <Icon size={10} className={good ? "text-gold" : "text-muted-foreground"} />
      <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
    <span className={cn(
      "text-sm font-display font-black tabular-nums",
      good ? "text-gold" : "text-foreground/85",
    )}>
      {value}
    </span>
  </div>
);

export default StateCard;
