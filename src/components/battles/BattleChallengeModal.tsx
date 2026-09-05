import { Clock, Swords, Zap, Snowflake, Dumbbell, Brain, Droplets, Flame } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
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
  <Portal>
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border-t border-border rounded-t-3xl p-6 home-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
        <h2 className="font-display font-bold text-lg mb-1">Challenge @{username}</h2>
        <p className="text-xs text-muted-foreground mb-4">Pick a battle type and duration</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {BATTLE_TYPES.map((bt) => {
            const selected = battleType === bt.id;
            return (
              <button
                key={bt.id}
                onClick={() => setBattleType(bt.id)}
                className={cn(
                  "press flex items-center gap-2 rounded-xl border p-3 text-left transition-all ",
                  selected ? "border-gold/40 bg-gold/5" : "border-border bg-secondary/30 hover:bg-secondary/60",
                )}
              >
                <span className="text-lg">{bt.emoji}</span>
                <div>
                  <p className={cn("text-xs font-semibold", selected && "text-gold")}>{bt.label}</p>
                  <p className="text-[12px] text-muted-foreground">{bt.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs font-semibold mb-2 flex items-center gap-1"><Clock size={12} /> Duration</p>
        <div className="flex gap-2 mb-5">
          {BATTLE_DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={cn(
                "press flex-1 rounded-lg border py-2 text-xs font-bold transition-all ",
                duration === d ? "border-gold/40 bg-gold/10 text-gold" : "border-border bg-secondary/30",
              )}
            >
              {d}d
            </button>
          ))}
        </div>

        <Button variant="ember" className="w-full rounded-full" onClick={onChallenge} disabled={creating}>
          <Swords size={14} />
          {creating ? "Sending…" : "Send Challenge"}
        </Button>
      </div>
    </div>
  </Portal>
);

export default BattleChallengeModal;
