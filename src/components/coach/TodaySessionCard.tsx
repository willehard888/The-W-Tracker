import { dayFocus, daySummary, isRestDay, isTrainingDay } from "@/lib/training/session";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

const LABEL = "text-[11px] font-bold text-muted-foreground";

interface Props {
  program: CoachProgram;
  currentWeek: number;
  todayDayIndex: number;
  logs: ProgramLog[];
  onLogged: () => void;
}

/**
 * Today's session: the page's one hero surface. The beat above already says
 * the week, so this card says the day — its focus, its length, and the way
 * into the runner.
 */
const TodaySessionCard = ({ program, currentWeek, todayDayIndex, logs, onLogged }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const isRest = isRestDay(day);
  const canStart = !isRest && !todayLog && day.blocks.length > 0;
  const recovery = week?.recovery;
  // On a rest day the card's second line points forward — the next session
  // this week, wrapping to Monday — instead of saying "Rest" twice.
  const days = week?.days ?? [];
  const nextUp = isRest
    ? [...days.slice(todayDayIndex + 1), ...days.slice(0, todayDayIndex)].find((d) => isTrainingDay(d))
    : undefined;

  const markDone = async () => {
    if (!user) return;
    setSaving(true);
    // Upsert, not insert. The table carries UNIQUE(program_id, week, day_index),
    // so a plain insert 409s on any second attempt — which is what a retry after
    // a flaky connection is, and what a stale `todayLog` would cause. The button
    // is disabled once logged, so the conflict never surfaced as a visible bug,
    // but it made the one write path in the training feature fragile for the
    // exact case it most needed to survive: bad gym wifi.
    const { error } = await supabase.from("coach_program_logs").upsert(
      {
        user_id: user.id,
        program_id: program.id,
        week: currentWeek,
        day_index: todayDayIndex,
        completed: true,
        // The runner's start() may have left this row in_progress; PostgREST
        // upserts only the columns given, so say it explicitly.
        status: "completed",
        logged_at: new Date().toISOString(),
      },
      { onConflict: "program_id,week,day_index" },
    );
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
    <div className="surface-card p-4">
      <h2 className="font-display font-black text-[20px] leading-[1.1] tracking-tight">
        {isRest ? "Rest day" : dayFocus(day) || "Today's session"}
      </h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {nextUp ? `Next up: ${dayFocus(nextUp)} · ${nextUp.day}` : daySummary(day)}
      </p>

      {/* The primary action on this card is starting, not reading. The list
          below stays for anyone who wants to see the session first. */}
      {canStart && (
        <Button
          variant="ember"
          size="lg"
          className="w-full mt-4"
          onClick={() => {
            hapticImpact("medium");
            navigate(`/coach/session/${currentWeek}/${todayDayIndex}`);
          }}
        >
          <Play size={16} aria-hidden /> Start workout
        </Button>
      )}

      {!isRest ? (
        <div className="mt-4 space-y-1.5">
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
                block={b}
                programId={program.id}
                week={currentWeek}
                dayIndex={todayDayIndex}
              />
            ))}
            {day.conditioning && (
              <li className="pt-1 text-[12px] text-foreground/85">
                <span className={cn(LABEL, "mr-1.5")}>Conditioning</span>
                {day.conditioning}
              </li>
            )}
          </ul>

          {day.cooldown && (
            <CollapseRow
              label="Cooldown"
              preview={day.cooldown}
              open={openCooldown}
              onToggle={() => { hapticImpact("light"); setOpenCooldown(v => !v); }}
            />
          )}
        </div>
      ) : recovery ? (
        <p className="mt-3 text-[13px] text-muted-foreground leading-snug">
          {recovery.mobility_min} min mobility · {recovery.breathwork} · sleep {recovery.sleep_target_h}h.
        </p>
      ) : null}

      {/* Done. Quiet while Start leads; the ember when it is the only act. */}
      <Button
        variant={alreadyLogged ? "secondary" : canStart ? "outline" : "ember"}
        size="lg"
        disabled={alreadyLogged || saving}
        onClick={markDone}
        className="w-full font-black mt-4"
      >
        {saving ? <Loader2 size={16} className="animate-spin" />
          : alreadyLogged ? <><Check size={16} /> Done · today</>
          : <><Check size={16} /> {isRest ? "Mark rest" : "Done"}</>}
      </Button>

      {/* Effort — only after a real session is logged, and only until it's
          answered. A rest day has no effort worth rating. */}
      {alreadyLogged && !isRest && todayLog?.perceived_rpe == null && (
        <div className="mt-4">
          <p className="text-[13px] font-bold mb-2">How hard was it?</p>
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
                  "press transition-colors disabled:opacity-50",
                  "border-border/60 bg-secondary/40 text-muted-foreground",
                  "hover:border-gold/40 hover:text-gold",
                  rpeSaving === value && "commit-pop",
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
  );
};

const CollapseRow = ({
  label, preview, open, onToggle,
}: { label: string; preview: string; open: boolean; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    className="w-full min-h-11 text-left flex items-start gap-2 px-0 py-2"
  >
    <span className={cn(LABEL, "mt-0.5 shrink-0")}>{label}</span>
    <span className={cn(
      "text-[12px] leading-snug flex-1",
      open ? "text-foreground/90" : "text-foreground/70 truncate",
    )}>
      {preview}
    </span>
    <ChevronDown size={12} className={cn("text-muted-foreground/70 mt-1 transition-transform shrink-0", open && "rotate-180")} aria-hidden />
  </button>
);

export default TodaySessionCard;
