import { useMemo, useState } from "react";
import { Check, Clock, Dumbbell, Wind, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CoachProgram, ProgramLog } from "@/hooks/use-coach-program";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { hapticNotification } from "@/lib/haptics";

interface Props {
  program: CoachProgram;
  currentWeek: number;
  todayDayIndex: number;
  logs: ProgramLog[];
  onLogged: () => void;
}

const TodaySessionCard = ({ program, currentWeek, todayDayIndex, logs, onLogged }: Props) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const week = program.plan_json.weeks.find((w) => w.week === currentWeek);
  const day = week?.days[todayDayIndex];

  const alreadyLogged = useMemo(
    () =>
      logs.some(
        (l) => l.week === currentWeek && l.day_index === todayDayIndex && l.completed,
      ),
    [logs, currentWeek, todayDayIndex],
  );

  if (!day) return null;
  const isRest = day.focus.toLowerCase() === "rest";

  const markDone = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("coach_program_logs").insert({
      user_id: user.id,
      program_id: program.id,
      week: currentWeek,
      day_index: todayDayIndex,
      completed: true,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't log session.");
      return;
    }
    hapticNotification("success");
    toast.success(isRest ? "Rest logged. Recover well." : "Session logged. Great work.");
    onLogged();
  };

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div
        className={cn(
          "relative rounded-3xl overflow-hidden border p-5",
          "bg-gradient-to-b from-gold/[0.10] via-card/95 to-card border-gold/35",
          "shadow-[0_20px_60px_-20px_hsl(var(--gold)/0.35)]",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl opacity-60"
          style={{ background: "radial-gradient(circle, hsl(var(--gold)/0.45), transparent 70%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black tracking-[0.22em] uppercase text-gold">
              Today · Week {currentWeek} · {day.day}
            </span>
          </div>
          <h2 className="font-display text-[28px] leading-[1.05] font-black tracking-tight mb-1">
            {day.focus}
          </h2>
          {!isRest && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-4">
              <span className="inline-flex items-center gap-1">
                <Clock size={11} className="text-gold" />
                {day.duration_min} min
              </span>
              <span className="inline-flex items-center gap-1">
                <Dumbbell size={11} className="text-gold" />
                {day.blocks.length} block{day.blocks.length !== 1 && "s"}
              </span>
            </div>
          )}

          {!isRest ? (
            <ul className="space-y-2 mb-5">
              {day.blocks.map((b, i) => (
                <li
                  key={i}
                  className="rounded-xl bg-background/40 border border-border/40 px-3 py-2.5"
                >
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <p className="font-bold text-sm text-foreground">{b.name}</p>
                    <p className="text-[11px] font-black tracking-wider text-gold whitespace-nowrap">
                      {b.sets} × {b.reps}
                      {b.rpe ? ` @ RPE ${b.rpe}` : ""}
                    </p>
                  </div>
                  {b.notes && (
                    <p className="text-[11px] text-muted-foreground leading-snug">{b.notes}</p>
                  )}
                </li>
              ))}
              {day.conditioning && (
                <li className="rounded-xl bg-background/40 border border-border/40 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gold mb-0.5">
                    Conditioning
                  </p>
                  <p className="text-[12px] text-foreground/85">{day.conditioning}</p>
                </li>
              )}
            </ul>
          ) : (
            <div className="rounded-xl bg-background/40 border border-border/40 p-4 mb-5">
              <div className="flex items-center gap-2 mb-1.5">
                <Wind size={14} className="text-gold" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gold">
                  Recovery focus
                </p>
              </div>
              <p className="text-[12px] text-foreground/85 leading-snug">
                {week!.recovery.mobility_min} min mobility · breathwork: {week!.recovery.breathwork} ·
                sleep target {week!.recovery.sleep_target_h} h.
              </p>
            </div>
          )}

          <Button
            variant={alreadyLogged ? "secondary" : "gold"}
            size="lg"
            disabled={alreadyLogged || saving}
            onClick={markDone}
            className="w-full font-black"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : alreadyLogged ? (
              <>
                <Check size={16} /> Logged for today
              </>
            ) : (
              <>
                <Check size={16} /> {isRest ? "Mark rest day" : "Mark session done"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Week context */}
      {week && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
            Week {week.week} theme
          </p>
          <p className="font-display text-base font-black mb-2">{week.theme}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Sleep" value={`${week.recovery.sleep_target_h}h`} />
            <Stat label="Protein" value={`${week.nutrition.protein_g_per_kg}g/kg`} />
            <Stat label="Mobility" value={`${week.recovery.mobility_min}m`} />
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-background/40 border border-border/40 px-2 py-2">
    <p className="font-display text-base font-black text-gold leading-none">{value}</p>
    <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
  </div>
);

export default TodaySessionCard;
