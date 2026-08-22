import { useState } from "react";
import { Moon, Dumbbell, Droplets, Brain, ShieldCheck, Check, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import SportPicker from "@/components/checkin/SportPicker";
import type { Sport } from "@/lib/sports";
import { HYDRATION_DONE_LITERS, SLEEP_OPTIMAL_MIN_H, SLEEP_OPTIMAL_MAX_H } from "@/lib/checkin-xp";

export type WorkoutChoice = "trained" | "rest" | null;

interface CoreFourProps {
  // sleep
  sleep: number;
  onSleep: (h: number) => void;
  sleepOptimal: boolean;
  sleepLabel: string;
  sleepXp: number;
  sleepDetected: boolean;
  // workout
  workoutChoice: WorkoutChoice;
  onWorkoutChoice: (c: WorkoutChoice) => void;
  selectedSport: Sport | null;
  onSelectSport: (id: string) => void;
  forYou: Sport[];
  detectedWorkout: boolean;
  detectedSportId: string | null;
  // water
  hydration: number;
  onHydration: (l: number) => void;
  hydrationXp: number;
  // meditation
  meditationDone: boolean;
  onToggleMeditation: () => void;
  meditationXp: number;
  meditationDetected: boolean;
  /** "Apple Health synced — workout, 8k+ steps detected." (one line) */
  healthLine?: string | null;
  onInfo?: () => void;
}

const Detected = () => (
  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal bg-teal/10 px-1.5 py-0.5 rounded-full">
    <ShieldCheck size={10} /> Detected
  </span>
);

const XpChip = ({ xp, done }: { xp: number; done: boolean }) => (
  <span className={cn("text-[11px] font-bold tabular-nums shrink-0", done ? "text-gold" : "text-muted-foreground/60")}>
    +{xp} XP{done ? " ✓" : ""}
  </span>
);

const cardCls = (done: boolean) =>
  cn(
    "rounded-2xl border p-4 transition-all duration-200",
    done
      ? "border-gold/45 bg-gradient-to-r from-gold/[0.10] to-gold/[0.03] shadow-[0_0_0_1px_hsl(var(--gold)/0.12),0_4px_14px_-6px_hsl(var(--gold)/0.3)]"
      : "border-border bg-card",
  );

const iconCls = (done: boolean) =>
  cn("flex h-11 w-11 items-center justify-center rounded-xl shrink-0 transition-colors", done ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground");

/**
 * THE CORE 4 — sleep, workout, water, meditation. Always asked, every day;
 * "done or not" — answering is what keeps the streak. These rows show their
 * XP because core always pays full value.
 */
const CoreFour = (p: CoreFourProps) => {
  const [sportOpen, setSportOpen] = useState(false);
  const workoutDone = p.workoutChoice === "trained" && !!p.selectedSport;

  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <p className="eyebrow text-gold/85 flex items-center gap-1.5">
          The Core 4 · logged every day
          {p.onInfo && (
            <button type="button" onClick={p.onInfo} aria-label="How the Core 4 works" className="text-muted-foreground/60 hover:text-foreground transition-colors">
              <Info size={11} />
            </button>
          )}
        </p>
      </div>
      {p.healthLine && (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] text-teal"><ShieldCheck size={12} /> {p.healthLine}</p>
      )}

      <div className="space-y-2.5">
        {/* Sleep */}
        <div className={cardCls(p.sleepOptimal)}>
          <div className="flex items-center gap-3 mb-3">
            <div className={iconCls(p.sleepOptimal)}><Moon size={20} /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm flex items-center gap-1.5">Sleep {p.sleepDetected && <Detected />}</p>
              <p className="text-xs text-muted-foreground">{SLEEP_OPTIMAL_MIN_H}–{SLEEP_OPTIMAL_MAX_H}h · {p.sleepLabel}</p>
            </div>
            <span className={cn("font-display text-xl font-black tabular-nums", p.sleepOptimal ? "text-gold" : "text-foreground/80")}>{p.sleep}h</span>
            <XpChip xp={p.sleepXp} done={p.sleepOptimal} />
          </div>
          <input type="range" min={4} max={12} step={0.5} value={p.sleep} onChange={(e) => p.onSleep(Number(e.target.value))} className="w-full accent-[hsl(var(--gold))] h-1.5" />
        </div>

        {/* Workout — Trained / Rest day: the one core item that can be unanswered */}
        <div className={cn(cardCls(workoutDone), p.workoutChoice === null && "border-dashed")}>
          <div className="flex items-center gap-3">
            <div className={iconCls(workoutDone)}><Dumbbell size={20} /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm flex items-center gap-1.5">
                {workoutDone ? `${p.selectedSport!.emoji} ${p.selectedSport!.label}` : "Workout"}
                {p.detectedWorkout && <Detected />}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.workoutChoice === null
                  ? (p.detectedWorkout ? "Health saw a workout — pick your sport" : "Did you train today?")
                  : p.workoutChoice === "rest" ? "Rest day — logged" : "Tap to change sport"}
              </p>
            </div>
            {workoutDone && <XpChip xp={p.selectedSport!.xp} done />}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { hapticSelection(); p.onWorkoutChoice("trained"); setSportOpen(true); }}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-bold transition-all active:scale-[0.97] inline-flex items-center justify-center gap-1.5",
                p.workoutChoice === "trained" ? "border-gold/50 bg-gold/12 text-gold" : "border-border bg-secondary text-foreground/80",
              )}
            >
              Trained <ChevronDown size={14} className={cn("transition-transform", sportOpen && "rotate-180")} />
            </button>
            <button
              type="button"
              onClick={() => { hapticSelection(); p.onWorkoutChoice("rest"); setSportOpen(false); }}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-bold transition-all active:scale-[0.97]",
                p.workoutChoice === "rest" ? "border-gold/50 bg-gold/12 text-gold" : "border-border bg-secondary text-foreground/80",
              )}
            >
              Rest day
            </button>
          </div>
          {p.workoutChoice === "trained" && sportOpen && (
            <SportPicker
              forYou={p.forYou}
              selectedId={p.selectedSport?.id ?? "none"}
              detectedSportId={p.detectedSportId}
              onSelect={(id) => { p.onSelectSport(id); setSportOpen(false); }}
            />
          )}
        </div>

        {/* Water */}
        <div className={cardCls(p.hydration >= HYDRATION_DONE_LITERS)}>
          <div className="flex items-center gap-3 mb-3">
            <div className={iconCls(p.hydration >= HYDRATION_DONE_LITERS)}><Droplets size={20} /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">Water</p>
              <p className="text-xs text-muted-foreground">Target {HYDRATION_DONE_LITERS}L+</p>
            </div>
            <span className={cn("font-display text-xl font-black tabular-nums", p.hydration >= HYDRATION_DONE_LITERS ? "text-gold" : "text-foreground/80")}>{p.hydration}L</span>
            <XpChip xp={p.hydrationXp} done={p.hydration >= HYDRATION_DONE_LITERS} />
          </div>
          <input type="range" min={0} max={5} step={0.5} value={p.hydration} onChange={(e) => p.onHydration(Number(e.target.value))} className="w-full accent-[hsl(var(--gold))] h-1.5" />
        </div>

        {/* Meditation */}
        <button
          type="button"
          onClick={() => { hapticSelection(); p.onToggleMeditation(); }}
          className={cn(cardCls(p.meditationDone), "w-full text-left flex items-center gap-3 active:scale-[0.985]")}
        >
          <div className={iconCls(p.meditationDone)}><Brain size={20} /></div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm flex items-center gap-1.5">Meditation {p.meditationDetected && <Detected />}</p>
            <p className="text-xs text-muted-foreground">Any length counts</p>
          </div>
          <XpChip xp={p.meditationXp} done={p.meditationDone} />
          <span className={cn(
            "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
            p.meditationDone ? "border-gold bg-gold shadow-[0_0_10px_-1px_hsl(var(--gold)/0.6)]" : "border-muted-foreground/30",
          )}>
            {p.meditationDone && <Check size={14} className="text-primary-foreground" strokeWidth={3} />}
          </span>
        </button>
      </div>
    </section>
  );
};

export default CoreFour;
