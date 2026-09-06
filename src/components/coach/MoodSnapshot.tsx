import { useState } from "react";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import { useTodayReflection } from "@/hooks/use-coach-reflection";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";

/**
 * Pre-chat mood capture — shown above the chat body when today has
 * no `coach_reflection` row yet. Two emoji rows (energy + mood, 1..5).
 * Defaults to the user's baseline so a satisfied user can ship it in
 * one tap. On submit we:
 *   1. Persist via `upsert_reflection` RPC (so the AI coach sees it
 *      on future chat invocations even without `mood_today` payload).
 *   2. Hand the captured `{ energy, mood }` back so the next outbound
 *      ai-coach call includes it as `mood_today`.
 *
 * Skipped automatically by the caller when today's reflection exists.
 */

const ENERGY_EMOJI = ["😴", "😪", "🙂", "😊", "⚡"] as const;
const MOOD_EMOJI = ["😢", "😕", "😐", "🙂", "😄"] as const;

interface Props {
  onCaptured: (snapshot: { energy: number; mood: number }) => void;
  onSkip: () => void;
}

const MoodSnapshot = ({ onCaptured, onSkip }: Props) => {
  const { profile } = useAthleteProfile();
  const { submit } = useTodayReflection();

  // Baseline-anchored defaults — user typically just confirms.
  const [energy, setEnergy] = useState<number>(profile?.stress_baseline
    ? Math.max(1, Math.min(5, 6 - profile.stress_baseline))
    : 3);
  const [mood, setMood] = useState<number>(profile?.mood_baseline ?? 3);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    hapticImpact("medium");
    try {
      await submit.mutateAsync({ energy_1to5: energy, mood_1to5: mood });
      onCaptured({ energy, mood });
    } catch {
      // submit() shows its own toast; fall through to onCaptured so the
      // user isn't blocked from chatting even if RPC fails.
      onCaptured({ energy, mood });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface-card surface-card-quiet mx-4 mb-3 px-4 pt-3 pb-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold">Ten-second check-in</p>
        <button
          type="button"
          onClick={() => { hapticImpact("light"); onSkip(); }}
          className="press min-h-11 -mr-2 px-2 text-[12px] font-medium text-muted-foreground"
          aria-label="Skip mood snapshot"
        >
          Skip
        </button>
      </div>

      <p className="text-[12px] text-muted-foreground mb-1.5">How's your energy?</p>
      <EmojiRow value={energy} onChange={setEnergy} emojis={ENERGY_EMOJI} />

      <p className="text-[12px] text-muted-foreground mb-1.5 mt-3">And your mood?</p>
      <EmojiRow value={mood} onChange={setMood} emojis={MOOD_EMOJI} />

      <Button
        variant="ember"
        size="sm"
        className="w-full mt-4 min-h-11"
        onClick={handleSubmit}
        disabled={saving}
      >
        {saving ? "Saving…" : "Start coaching"}
      </Button>
    </div>
  );
};

const EmojiRow = ({
  value, onChange, emojis,
}: { value: number; onChange: (v: number) => void; emojis: readonly string[] }) => (
  <div className="flex gap-1.5">
    {emojis.map((e, i) => {
      const v = i + 1;
      const active = value === v;
      return (
        <button
          key={v}
          type="button"
          onClick={() => { hapticImpact("light"); onChange(v); }}
          className={`press flex-1 h-11 rounded-xl text-lg transition-colors border ${
            active ? "bg-gold/15 border-gold/60" : "surface-inset border-border/40"
          }`}
          aria-pressed={active}
          aria-label={`Rate ${v} of 5`}
        >
          {e}
        </button>
      );
    })}
  </div>
);

export default MoodSnapshot;
