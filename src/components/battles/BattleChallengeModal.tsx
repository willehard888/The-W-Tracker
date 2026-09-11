import { useState } from "react";
import { Clock, Swords, Zap, Snowflake, Dumbbell, Brain, Droplets, Flame } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** THE battle types — the challenge flow, the Battles page and the cards all read from here. */
export const BATTLE_TYPES = [
  { id: "xp", label: "Total XP", icon: Zap, description: "Most XP earned wins", color: "text-gold", unit: "XP" },
  { id: "cold_shower", label: "Cold Showers", icon: Snowflake, description: "Most cold showers", color: "text-blue-400", unit: "showers" },
  { id: "workout", label: "Workouts", icon: Dumbbell, description: "Most workouts done", color: "text-[hsl(var(--streak-orange))]", unit: "workouts" },
  { id: "meditation", label: "Meditation", icon: Brain, description: "Most meditation sessions", color: "text-ember-light", unit: "sessions" },
  { id: "hydration", label: "Hydration", icon: Droplets, description: "Most liters of water", color: "text-cyan-400", unit: "L" },
  { id: "streak", label: "Streak", icon: Flame, description: "Longest streak during battle", color: "text-[hsl(var(--streak-orange))]", unit: "days" },
] as const;

export const BATTLE_DURATIONS = [3, 7, 14, 30];

interface BattleChallengeModalProps {
  username: string;
  battleType: string;
  setBattleType: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  creating: boolean;
  onClose: () => void;
  onChallenge: () => void;
}

/** The one 1v1 challenge flow — used from Battles and from a user's profile. */
const BattleChallengeModal = ({
  username, battleType, setBattleType, duration, setDuration, creating, onClose, onChallenge,
}: BattleChallengeModalProps) => {
  // The pop belongs to a tap, not to the sheet opening with "xp" preselected;
  // it clears on animationend so no transform stays pinned on the tile.
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <BottomSheet
      open
      onClose={onClose}
      label={`Challenge @${username}`}
      title={`Challenge @${username}`}
      subtitle="Pick a discipline and how long it runs"
      footer={
        <Button variant="ember" className="w-full rounded-full" onClick={onChallenge} disabled={creating}>
          <Swords aria-hidden size={14} />
          {creating ? "Sending…" : "Send challenge"}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2 mb-4">
        {BATTLE_TYPES.map((bt) => {
          const selected = battleType === bt.id;
          return (
            <button
              key={bt.id}
              type="button"
              onClick={() => { setBattleType(bt.id); setPicked(bt.id); }}
              onAnimationEnd={() => setPicked(null)}
              aria-pressed={selected}
              className={cn(
                "press flex items-center gap-2.5 rounded-xl border px-3 py-2.5 min-h-11 text-left transition-[border-color]",
                selected ? "border-gold" : "border-border",
                selected && picked === bt.id && "commit-pop",
              )}
            >
              <bt.icon size={16} className={cn("shrink-0", selected ? "text-gold" : "text-muted-foreground")} aria-hidden />
              <span className="min-w-0">
                <span className={cn("block text-[13px] font-bold leading-tight", selected && "text-gold")}>{bt.label}</span>
                <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">{bt.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] font-bold text-muted-foreground mb-2 flex items-center gap-1"><Clock size={11} aria-hidden /> Duration</p>
      <div className="flex gap-2">
        {BATTLE_DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDuration(d)}
            aria-pressed={duration === d}
            className={cn(
              "press flex-1 rounded-xl border min-h-11 text-[13px] font-bold transition-[border-color,color]",
              duration === d ? "border-gold text-gold" : "border-border text-muted-foreground",
            )}
          >
            {d}d
          </button>
        ))}
      </div>
    </BottomSheet>
  );
};

export default BattleChallengeModal;
