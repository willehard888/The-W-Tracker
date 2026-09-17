import { dayFocus, daySummary, isRestDay, isTrainingDay } from "@/lib/training/session";
import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CoachProgram, ProgramBlock, ProgramLog } from "@/hooks/use-coach-program";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import ExerciseRow from "@/components/coach/ExerciseRow";

// Full 1–10 RPE. The readiness formula in coach-daily-plan clamps anything
// below 6 to the same score, but the number is the athlete's own record of the
// session — truncating the easy end would store a harder session than happened.
const RPE_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const LABEL = "text-label font-bold text-muted-foreground";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Props {
  program: CoachProgram;
  week: number;
  dayIndex: number;
  isToday: boolean;
  /** The runner opens sessions of the week the athlete is in, not of a later one. */
  isCurrentWeek: boolean;
  logs: ProgramLog[];
  onLogged: () => void;
  /** Hand edits, offered per movement while nothing is logged for it. */
  onSwap?: (block: ProgramBlock) => void;
  onRemove?: (slug: string) => void;
  /** The day's own doors (add, rest, build), under everything else. */
  children?: ReactNode;
}

/**
 * One day of the program: the page's one hero surface. The strip above picks
 * the day, so this card says it once: its name, its focus, its length, the way
 * into the runner, and the ways to change it by hand.
 */
const DaySessionCard = ({ program, week: currentWeek, dayIndex: todayDayIndex, isToday, isCurrentWeek, logs, onLogged, onSwap, onRemove, children }: Props) => {
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

  // A plan missing this day (a hand-written or cut-short row) still gets its
  // doors: they are the way to fix it.
  if (!day) return children ? <div className="surface-card p-4 divide-y divide-border/35">{children}</div> : null;
  const isRest = isRestDay(day);
  const inProgress = logs.some((l) => l.week === currentWeek && l.day_index === todayDayIndex && !l.completed && l.status === "in_progress");
  const canStart = isCurrentWeek && !isRest && !todayLog && day.blocks.length > 0;
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
      <p className="text-label font-bold text-muted-foreground mb-1">
        {DAY_NAMES[todayDayIndex] ?? day.day}{isToday ? " · Today" : ""}
      </p>
      <h2 className="font-display font-black text-head leading-[1.1] tracking-tight">
        {isRest ? "Rest day" : dayFocus(day) || "Today's session"}
      </h2>
      <p className="mt-1 text-dense text-muted-foreground">
        {nextUp ? `Next up: ${dayFocus(nextUp)} · ${nextUp.day}` : daySummary(day)}
      </p>

      {/* The primary action on this card is starting, not reading. The list
          below stays for anyone who wants to see the session first. */}
      {canStart && (
        <Button
          variant={isToday ? "ember" : "outline"}
          size="lg"
          className="w-full mt-4"
          onClick={() => {
            hapticImpact("medium");
            navigate(`/coach/session/${currentWeek}/${todayDayIndex}`);
          }}
        >
          <Play size={16} aria-hidden /> {inProgress ? "Continue workout" : "Start workout"}
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
                key={b.slug ?? i}
                block={b}
                programId={program.id}
                week={currentWeek}
                dayIndex={todayDayIndex}
                loggable={isCurrentWeek || !!todayLog}
                onSwap={onSwap && b.slug ? () => onSwap(b) : undefined}
                onRemove={onRemove && b.slug ? () => onRemove(b.slug!) : undefined}
              />
            ))}
            {day.conditioning && (
              <li className="pt-1 text-meta text-foreground/85">
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
        <p className="mt-3 text-dense text-muted-foreground leading-snug">
          {recovery.mobility_min} min mobility · {recovery.breathwork} · sleep {recovery.sleep_target_h}h.
        </p>
      ) : null}

      {/* Done belongs to today. Quiet while Start leads; on another day a
          finished session simply says so. */}
      {isToday ? (
        <Button
          variant={alreadyLogged ? "secondary" : canStart ? "outline" : "ember"}
          size="lg"
          disabled={alreadyLogged || saving}
          onClick={markDone}
          className="w-full font-black mt-4"
        >
          {saving ? <Loader2 aria-hidden size={16} className="animate-spin" />
            : alreadyLogged ? <><Check aria-hidden size={16} /> Done · today</>
            : <><Check aria-hidden size={16} /> {isRest ? "Mark rest" : "Done"}</>}
        </Button>
      ) : alreadyLogged ? (
        <p className="mt-4 flex items-center gap-1.5 text-dense font-bold text-xp-green">
          <Check aria-hidden size={14} /> Session logged
        </p>
      ) : null}

      {/* Effort — only after a real session is logged, and only until it's
          answered. A rest day has no effort worth rating. */}
      {isToday && alreadyLogged && !isRest && todayLog?.perceived_rpe == null && (
        <div className="mt-4">
          <p className="text-dense font-bold mb-2">How hard was it?</p>
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
                  "h-11 rounded-lg border text-dense font-black tabular-nums",
                  "press transition-colors disabled:opacity-50",
                  "border-border/60 bg-secondary/40 text-muted-foreground",
                  "hover:border-gold/40 hover:text-gold",
                  rpeSaving === value && "commit-pop",
                )}
              >
                {rpeSaving === value ? <Loader2 aria-hidden size={13} className="animate-spin mx-auto" /> : value}
              </button>
            ))}
          </div>
          <p className="text-label text-muted-foreground/75 mt-1.5 leading-snug">
            1 = easy · 10 = everything you had. This is what tomorrow's plan reads.
          </p>
        </div>
      )}

      {children && <div className="mt-4 border-t border-border/35 divide-y divide-border/35">{children}</div>}
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
      "text-meta leading-snug flex-1",
      open ? "text-foreground/90" : "text-foreground/75 truncate",
    )}>
      {preview}
    </span>
    <ChevronDown size={12} className={cn("text-muted-foreground/75 mt-1 transition-transform shrink-0", open && "rotate-180")} aria-hidden />
  </button>
);

export default DaySessionCard;
