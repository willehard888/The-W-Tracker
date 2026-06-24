import { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CoachProgram, ProgramLog } from "@/hooks/use-coach-program";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import ExerciseRow from "@/components/coach/ExerciseRow";

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
  const [openWarmup, setOpenWarmup] = useState(false);
  const [openCooldown, setOpenCooldown] = useState(false);

  const week = program.plan_json.weeks.find((w) => w.week === currentWeek);
  const day = week?.days[todayDayIndex];

  const alreadyLogged = useMemo(
    () => logs.some((l) => l.week === currentWeek && l.day_index === todayDayIndex && l.completed),
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
    if (error) { toast.error("Couldn't log session."); return; }
    hapticNotification("success");
    toast.success(isRest ? "Rest logged." : "Session done.");
    onLogged();
  };

  return (
    <div
      className={cn(
        "relative rounded-3xl overflow-hidden border p-5",
        "bg-card/70 border-border/50",
        "shadow-[0_12px_36px_-18px_hsl(0_0%_0%/0.6)]",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl opacity-50"
        style={{ background: "radial-gradient(circle, hsl(var(--gold)/0.4), transparent 70%)" }}
      />
      <div className="relative">
        {/* Header band */}
        <p className="text-[10px] font-black tracking-[0.2em] uppercase text-gold/90 mb-1">
          Today · W{currentWeek} · {day.day}
        </p>
        <h2 className="font-display text-[26px] leading-[1.05] font-black tracking-tight">
          {day.focus}
        </h2>
        {!isRest && (
          <p className="text-[11px] text-muted-foreground mt-1 mb-4">
            {day.duration_min} min · {day.blocks.length} block{day.blocks.length !== 1 && "s"}
          </p>
        )}

        {!isRest ? (
          <div className="space-y-1.5 mb-5">
            {day.warmup && (
              <CollapseRow
                label="Warm-up"
                preview={day.warmup}
                open={openWarmup}
                onToggle={() => { hapticImpact("light"); setOpenWarmup(v => !v); }}
              />
            )}

            <ul className="space-y-1.5 py-1">
              {day.blocks.map((b, i) => (
                <ExerciseRow
                  key={i}
                  block={b as any}
                  programId={program.id}
                  week={currentWeek}
                  dayIndex={todayDayIndex}
                />
              ))}
              {day.conditioning && (
                <li className="pt-1">
                  <p className="text-[9.5px] font-black uppercase tracking-widest text-gold mb-0.5">Conditioning</p>
                  <p className="text-[12px] text-foreground/85">{day.conditioning}</p>
                </li>
              )}
            </ul>

            {day.cooldown && (
              <CollapseRow
                label="Cooldown"
                preview={day.cooldown}
                open={openCooldown}
                onToggle={() => { hapticImpact("light"); setOpenCooldown(v => !v); }}
                muted
              />
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-background/40 border border-border/40 p-4 mb-5">
            <div className="flex items-center gap-2 mb-1.5">
              <Wind size={14} className="text-gold" />
              <p className="text-[10px] font-black uppercase tracking-widest text-gold">Recovery</p>
            </div>
            <p className="text-[12px] text-foreground/85 leading-snug">
              {week!.recovery.mobility_min} min mobility · {week!.recovery.breathwork} · sleep {week!.recovery.sleep_target_h}h.
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
          {saving ? <Loader2 size={16} className="animate-spin" />
            : alreadyLogged ? <><Check size={16} /> Done · today</>
            : <><Check size={16} /> {isRest ? "Mark rest" : "Done"}</>}
        </Button>
      </div>
    </div>
  );
};

const CollapseRow = ({
  label, preview, open, onToggle, muted,
}: { label: string; preview: string; open: boolean; onToggle: () => void; muted?: boolean }) => (
  <button
    type="button"
    onClick={onToggle}
    className={cn(
      "w-full text-left flex items-start gap-2 px-0 py-1.5",
    )}
  >
    <span className={cn(
      "text-[9.5px] font-black uppercase tracking-widest mt-0.5 shrink-0",
      muted ? "text-muted-foreground" : "text-gold",
    )}>{label}</span>
    <span className={cn(
      "text-[11.5px] leading-snug flex-1",
      open ? "text-foreground/90" : "text-foreground/70 truncate",
    )}>
      {preview}
    </span>
    <ChevronDown size={12} className={cn("text-muted-foreground/70 mt-1 transition-transform shrink-0", open && "rotate-180")} />
  </button>
);

export default TodaySessionCard;
