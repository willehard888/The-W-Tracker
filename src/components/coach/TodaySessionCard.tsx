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

// Full 1–10 RPE. The readiness formula in coach-daily-plan clamps anything
// below 6 to the same score, but the number is the athlete's own record of the
// session — truncating the easy end would store a harder session than happened.
const RPE_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

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
  const [rpeSaving, setRpeSaving] = useState<number | null>(null);
  const [openWarmup, setOpenWarmup] = useState(false);
  const [openCooldown, setOpenCooldown] = useState(false);

  const week = program.plan_json.weeks.find((w) => w.week === currentWeek);
  const day = week?.days[todayDayIndex];

  // Keep the row, not just a boolean — the RPE prompt below needs its id and
  // needs to know whether an RPE has already been given.
  const todayLog = useMemo(
    () => logs.find((l) => l.week === currentWeek && l.day_index === todayDayIndex && l.completed),
    [logs, currentWeek, todayDayIndex],
  );
  const alreadyLogged = !!todayLog;

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

  // How hard was it, actually.
  //
  // `perceived_rpe` has a column, RLS and three edge functions reading it, and
  // until now nothing ever wrote it — markDone inserted { completed: true } and
  // stopped. coach-daily-plan reads it for 25 of the 100 readiness points, so
  // every athlete scored the same default forever.
  //
  // Asked AFTER the session is already logged, never before: completion stays a
  // single tap, and skipping this costs nothing because coach-daily-plan now
  // falls back to the evening reflection's RPE.
  const saveRpe = async (value: number) => {
    if (!user || !todayLog) return;
    setRpeSaving(value);
    const { error } = await supabase
      .from("coach_program_logs")
      .update({ perceived_rpe: value })
      .eq("id", todayLog.id);
    setRpeSaving(null);
    if (error) { toast.error("Couldn't save that."); return; }
    hapticNotification("success");
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
        <p className="eyebrow text-gold/90 mb-1">
          Today · W{currentWeek} · {day.day}
        </p>
        <h2 className="font-display text-[26px] leading-[1.05] font-black tracking-tight">
          {day.focus}
        </h2>
        {!isRest && (
          <p className="text-[12px] text-muted-foreground mt-1 mb-4">
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
                  <p className="eyebrow text-gold mb-0.5">Conditioning</p>
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
              <p className="eyebrow text-gold">Recovery</p>
            </div>
            <p className="text-[12px] text-foreground/85 leading-snug">
              {week!.recovery.mobility_min} min mobility · {week!.recovery.breathwork} · sleep {week!.recovery.sleep_target_h}h.
            </p>
          </div>
        )}

        <Button
          variant={alreadyLogged ? "secondary" : "ember"}
          size="lg"
          disabled={alreadyLogged || saving}
          onClick={markDone}
          className="w-full font-black"
        >
          {saving ? <Loader2 size={16} className="animate-spin" />
            : alreadyLogged ? <><Check size={16} /> Done · today</>
            : <><Check size={16} /> {isRest ? "Mark rest" : "Done"}</>}
        </Button>

        {/* Effort — only after a real session is logged, and only until it's
            answered. A rest day has no effort worth rating. */}
        {alreadyLogged && !isRest && todayLog?.perceived_rpe == null && (
          <div className="mt-4">
            <p className="eyebrow text-muted-foreground mb-2">
              How hard was it?
            </p>
            {/* 5 across, so each target clears the 44pt floor — ten in one row
                would be ~35px wide on a phone. */}
            <div className="grid grid-cols-5 gap-1.5">
              {RPE_SCALE.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={rpeSaving != null}
                  onClick={() => { hapticImpact("light"); saveRpe(value); }}
                  aria-label={`Rate effort ${value} out of 10`}
                  className={cn(
                    "h-11 rounded-lg border text-[13px] font-black tabular-nums",
                    "transition-colors active:scale-[0.96] disabled:opacity-50",
                    "border-border/60 bg-secondary/40 text-muted-foreground",
                    "hover:border-gold/40 hover:text-gold",
                  )}
                >
                  {rpeSaving === value ? <Loader2 size={13} className="animate-spin mx-auto" /> : value}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/75 mt-1.5 leading-snug">
              1 = easy · 10 = everything you had. This is what tomorrow's plan reads.
            </p>
          </div>
        )}
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
      "eyebrow mt-0.5 shrink-0",
      muted ? "text-muted-foreground" : "text-gold",
    )}>{label}</span>
    <span className={cn(
      "text-[12px] leading-snug flex-1",
      open ? "text-foreground/90" : "text-foreground/70 truncate",
    )}>
      {preview}
    </span>
    <ChevronDown size={12} className={cn("text-muted-foreground/70 mt-1 transition-transform shrink-0", open && "rotate-180")} />
  </button>
);

export default TodaySessionCard;
