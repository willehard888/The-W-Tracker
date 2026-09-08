import { Clock, Swords, Zap, Snowflake, Dumbbell, Brain, Droplets, Flame } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The one 1v1 challenge flow — used from Battles and from a user's profile. */
export const BATTLE_TYPES = [
  { id: "xp", label: "Total XP", emoji: "⚡", icon: Zap, description: "Most XP earned wins" },
  { id: "cold_shower", label: "Cold Showers", emoji: "🧊", icon: Snowflake, description: "Most cold showers" },
  { id: "workout", label: "Workouts", emoji: "💪", icon: Dumbbell, description: "Most workouts done" },
  { id: "meditation", label: "Meditation", emoji: "🧘", icon: Brain, description: "Most meditation sessions" },
  { id: "hydration", label: "Hydration", emoji: "💧", icon: Droplets, description: "Most liters of water" },
  { id: "streak", label: "Streak", emoji: "🔥", icon: Flame, description: "Longest streak during battle" },
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

const BattleChallengeModal = ({
  username, battleType, setBattleType, duration, setDuration, creating, onClose, onChallenge,
}: BattleChallengeModalProps) => (
  <BottomSheet
    open
    onClose={onClose}
    label={`Challenge @${username}`}
    title={`Challenge @${username}`}
    subtitle="Pick a battle type and duration"
    footer={
      <Button variant="ember" className="w-full rounded-full" onClick={onChallenge} disabled={creating}>
        <Swords size={14} />
        {creating ? "Sending…" : "Send Challenge"}
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
            onClick={() => setBattleType(bt.id)}
            aria-pressed={selected}
            className={cn(
              "press flex items-center gap-2 rounded-xl border p-3 min-h-11 text-left transition-[border-color,background-color]",
              selected ? "border-gold/40 bg-gold/5" : "border-border bg-secondary/30",
            )}
          >
            <bt.icon size={16} className={selected ? "text-gold" : "text-muted-foreground"} aria-hidden />
            <div>
              <p className={cn("text-xs font-semibold", selected && "text-gold")}>{bt.label}</p>
              <p className="text-[12px] text-muted-foreground">{bt.description}</p>
            </div>
          </button>
        );
      })}
    </div>

    <p className="text-xs font-semibold mb-2 flex items-center gap-1"><Clock size={12} aria-hidden /> Duration</p>
    <div className="flex gap-2">
      {BATTLE_DURATIONS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setDuration(d)}
          aria-pressed={duration === d}
          className={cn(
            "press flex-1 rounded-lg border min-h-11 text-xs font-bold transition-[border-color,background-color]",
            duration === d ? "border-gold/40 bg-gold/10 text-gold" : "border-border bg-secondary/30",
          )}
        >
          {d}d
        </button>
      ))}
    </div>
  </BottomSheet>
);

export default BattleChallengeModal;
