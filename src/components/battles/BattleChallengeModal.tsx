import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock, Swords, ShieldCheck } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BATTLE_TYPES, BATTLE_DURATIONS, HEALTH_SYNC_WINDOW_HOURS, battleTypeInfo } from "./battle-types";

export { BATTLE_TYPES, BATTLE_DURATIONS } from "./battle-types";

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

/**
 * Has this member synced Apple Health recently enough to battle on it? The
 * server checks the same 48 h window on create and on accept; this only keeps
 * the three health tiles honest before the tap.
 */
const useHealthSyncFresh = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["health-sync-fresh", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - HEALTH_SYNC_WINDOW_HOURS * 3_600_000).toISOString();
      const { count } = await supabase
        .from("health_sync_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .gte("last_synced_at", since);
      return (count ?? 0) > 0;
    },
  });
};

/** The one 1v1 challenge flow: a discipline, a length, one button. Used from Battles and from a member's profile. */
const BattleChallengeModal = ({
  username, battleType, setBattleType, duration, setDuration, creating, onClose, onChallenge,
}: BattleChallengeModalProps) => {
  // The pop belongs to a tap, not to the sheet opening with a preselection;
  // it clears on animationend so no transform stays pinned on the tile.
  const [picked, setPicked] = useState<string | null>(null);
  const { data: healthFresh } = useHealthSyncFresh();
  const chosen = battleTypeInfo(battleType);
  const chosenBlocked = chosen.verified && healthFresh === false;

  return (
    <BottomSheet
      open
      onClose={onClose}
      label={`Challenge @${username}`}
      title={`Challenge @${username}`}
      subtitle="One discipline. The days decide."
      footer={
        <Button variant="ember" size="lg" className="w-full rounded-full" onClick={onChallenge} disabled={creating || chosenBlocked}>
          <Swords aria-hidden size={14} />
          {creating ? "Sending…" : `Send · ${duration} days · ${chosen.label}`}
        </Button>
      }
    >
      <ul className="space-y-1.5 mb-5" aria-label="Discipline">
        {BATTLE_TYPES.map((bt) => {
          const selected = battleType === bt.id;
          const blocked = bt.verified && healthFresh === false;
          return (
            <li key={bt.id}>
              <button
                type="button"
                onClick={() => { setBattleType(bt.id); setPicked(bt.id); }}
                onAnimationEnd={() => setPicked(null)}
                aria-pressed={selected}
                className={cn(
                  "press flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 min-h-[52px] text-left transition-[background-color,border-color]",
                  selected ? "border-transparent bg-gold text-background" : "border-border/60 bg-card/30",
                  selected && picked === bt.id && "commit-pop",
                )}
              >
                <bt.icon size={18} className={cn("shrink-0", selected ? "text-background" : bt.color)} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-dense font-bold leading-tight", selected ? "text-background" : "text-foreground")}>{bt.label}</span>
                  <span className={cn("block text-label leading-snug mt-0.5", selected ? "text-background/80" : "text-muted-foreground")}>
                    {blocked ? "Sync Apple Health today to battle on this." : bt.description}
                  </span>
                </span>
                {bt.verified ? (
                  <span
                    className={cn("inline-flex items-center gap-1 text-label font-bold shrink-0", selected ? "text-background/85" : "text-[hsl(var(--xp-green))]")}
                    aria-label="Verified by Apple Health"
                  >
                    <ShieldCheck size={12} aria-hidden /> Health
                  </span>
                ) : selected ? (
                  <Check size={16} className="shrink-0 text-background" aria-hidden />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-label font-bold text-muted-foreground mb-2 flex items-center gap-1">
        <Clock size={11} aria-hidden /> Length
      </p>
      <div className="flex rounded-xl border border-border/60 p-1 gap-1" role="radiogroup" aria-label="Length">
        {BATTLE_DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={duration === d}
            onClick={() => setDuration(d)}
            className={cn(
              "press flex-1 rounded-lg min-h-11 text-dense font-bold transition-[background-color,color]",
              duration === d ? "bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            {d} days
          </button>
        ))}
      </div>
      <p className="mt-3 text-label text-muted-foreground leading-snug">
        Starts the day after they accept. Scored from each side's own check-ins or Apple Health, decided on the last night. The winner takes the W — on the record.
      </p>
    </BottomSheet>
  );
};

export default BattleChallengeModal;
