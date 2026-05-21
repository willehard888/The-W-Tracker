import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserHabits } from "@/hooks/use-user-habits";
import { getProtocol, type Protocol, HABIT_LEVELS } from "@/lib/wellness-framework";
import HabitCard from "./HabitCard";
import ProtocolSheet from "./ProtocolSheet";

const HabitsTab = () => {
  const navigate = useNavigate();
  const { habits, isLoading, completedTodaySet, logHabit, archiveHabit } = useUserHabits();
  const [openProtocol, setOpenProtocol] = useState<Protocol | null>(null);

  if (isLoading) {
    return <div className="rounded-2xl border border-border/40 bg-card/40 h-44 animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-b from-gold/[0.08] to-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={12} className="text-gold" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">
            Long-game habits
          </p>
        </div>
        <p className="text-[12px] text-muted-foreground leading-snug">
          Pick up to 8 protocols you want to compound — ideally spread across
          the 6 health pillars. Daily check-offs build streaks and unlock 5
          levels: Spark → Rhythm → Locked-in → Compound → Identity.
        </p>
        <Button
          variant="ember-glass"
          size="sm"
          onClick={() => navigate("/coach/library")}
          className="w-full mt-3"
        >
          <BookOpen size={13} /> Browse protocol library
        </Button>
      </div>

      {/* Active habits */}
      {habits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-6 text-center">
          <p className="text-[13px] font-bold mb-1">No active habits yet</p>
          <p className="text-[11px] text-muted-foreground mb-4">
            Open the library and add up to 8 evidence-graded protocols.
          </p>
          <Button variant="gold" size="sm" onClick={() => navigate("/coach/library")}>
            <Plus size={13} /> Add your first habit
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {habits.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              doneToday={completedTodaySet.has(h.id)}
              onLog={async () => {
                const r = await logHabit(h.id);
                // Toast handled here so the row gets clean +XP feedback
                const { toast } = await import("sonner");
                toast.success(`+${r.xp_awarded} XP`, {
                  description: `Lv ${r.level} · ${r.streak}d streak`,
                });
              }}
              onArchive={() => archiveHabit(h.id)}
              onOpen={() => setOpenProtocol(getProtocol(h.protocol_id) ?? null)}
            />
          ))}
        </div>
      )}

      {/* Level legend */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground mb-2">
          Habit progression
        </p>
        <ul className="space-y-1">
          {HABIT_LEVELS.map((lv) => (
            <li key={lv.level} className="flex items-baseline gap-2 text-[11px]">
              <span className="font-black text-gold tabular-nums w-12">Lv {lv.level}</span>
              <span className="font-bold w-20">{lv.name}</span>
              <span className="text-muted-foreground w-14 tabular-nums">{lv.min_streak}d+</span>
              <span className="text-muted-foreground/85 truncate">{lv.blurb}</span>
            </li>
          ))}
        </ul>
      </div>

      <ProtocolSheet
        protocol={openProtocol}
        open={!!openProtocol}
        onOpenChange={(v) => !v && setOpenProtocol(null)}
      />

      <p className="text-[10px] text-muted-foreground/70 text-center italic">
        Educational guidance — not medical advice.
      </p>
    </div>
  );
};

export default HabitsTab;
