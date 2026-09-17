import { useState, type Ref } from "react";
import { ChevronDown } from "lucide-react";
import { useEditProgram, type CoachProgram, type ProgramBlock, type ProgramLog, type ProgramWeek } from "@/hooks/use-coach-program";
import { loadEngine } from "@/hooks/use-focus-session";
import { isRestDay, isTrainingDay } from "@/lib/training/session";
import { addBlock, isRepeatingWeek, removeBlock, replaceBlock, setRest, setTraining, type At } from "@/lib/training/plan-edit";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { track, FUNNEL } from "@/lib/analytics";
import { DoorRow, FactRow } from "@/components/coach/rows";
import WeekStrip from "@/components/coach/WeekStrip";
import DaySessionCard from "@/components/coach/DaySessionCard";
import ExercisePickerSheet from "@/components/coach/ExercisePickerSheet";
import FocusSessionSheet from "@/components/coach/FocusSessionSheet";

interface Props {
  program: CoachProgram;
  currentWeek: number;
  todayDayIndex: number;
  logs: ProgramLog[];
  onLogged: () => void;
  /** The onboarding spotlight lands on the strip. */
  stripRef?: Ref<HTMLDivElement>;
}

const nutritionLine = (n: ProgramWeek["nutrition"]) =>
  [
    n.protein_g_per_kg != null ? `Protein ${n.protein_g_per_kg} g/kg` : "",
    n.daily_kcal_band,
    n.notes,
  ].filter(Boolean).join(" · ");

const recoveryLine = (r: ProgramWeek["recovery"]) =>
  [
    r.sleep_target_h != null ? `Sleep ${r.sleep_target_h} h` : "",
    r.mobility_min != null ? `mobility ${r.mobility_min} min` : "",
    r.breathwork,
  ].filter(Boolean).join(" · ");

/**
 * Names a day from the muscles it mostly trains, by the engine's own map.
 * Returns a function of the slugs so the label is computed INSIDE the edit,
 * from the plan the edit is applied to: two quick removes used to name the
 * day after the list as it stood before the first one.
 */
const loadLabeller = async () => {
  const e = await loadEngine();
  return (slugs: (string | null | undefined)[]) => e.focusLabel(e.primaryFocuses(slugs.filter((x): x is string => !!x)));
};
const slugsOf = (plan: { weeks: ProgramWeek[] }, week: number, day: number) =>
  (plan.weeks.find((w) => w.week === week)?.days[day]?.blocks ?? []).map((b) => b.slug);

/**
 * The program, one day at a time: pick the week, pick the day on the strip,
 * and the one card below is that day. The week used to be on the page three
 * times (today's card, a read-only strip, a list of the same seven days);
 * now the strip is the selector and nothing is said twice.
 *
 * The plan bends by hand from the card: a rest day opens to "Coach builds
 * this day" or "Build it myself"; a training day takes a new movement, swaps
 * or drops one, or becomes a rest day (this week, or from here on). Edits
 * reach this week and the later ones; the past, a finished day and a movement
 * with sets already logged are never touched.
 */
const ProgramWeekView = ({ program, currentWeek, todayDayIndex, logs, onLogged, stripRef }: Props) => {
  const weeks = program.plan_json.weeks ?? [];
  const [weekNo, setWeekNo] = useState(currentWeek);
  const [dayIndex, setDayIndex] = useState(todayDayIndex);
  const [details, setDetails] = useState(false);
  const [picker, setPicker] = useState<{ current?: ProgramBlock } | null>(null);
  const [builder, setBuilder] = useState(false);
  const edit = useEditProgram(program);

  const week = weeks.find((w) => w.week === weekNo) ?? weeks[0];
  if (!week) return null;
  const day = week.days[dayIndex];
  const lastWeek = Math.max(...weeks.map((w) => w.week), 1);
  // Weeks ahead are shown only when somebody planned them: a week that
  // simply repeats is one week, and four identical rows said nothing.
  const plannedAhead = !isRepeatingWeek(program.plan_json, currentWeek);
  // In a planned block an add, a swap or a remove reaches the later weeks
  // too; say so where the athlete decides (a repeating week has no "later").
  const reach = plannedAhead && week.week < lastWeek ? "Also changes the weeks after this one" : undefined;
  const isCurrentWeek = week.week === currentWeek;
  const isLogged = logs.some((l) => l.week === week.week && l.day_index === dayIndex && l.completed);
  const inProgress = logs.some((l) => l.week === week.week && l.day_index === dayIndex && !l.completed && l.status === "in_progress");
  // The past and a finished day are history; a day under way keeps its shape.
  const canEdit = week.week >= currentWeek && !isLogged;
  const canRest = canEdit && !inProgress;
  const rest = !!day && isRestDay(day);

  const at = (scope: At["scope"] = "remaining"): At => ({ week: week.week, day: dayIndex, scope });
  const edited = (op: string, scope: At["scope"], via: "coach" | "manual") =>
    void track(FUNNEL.programEdited, { op, scope, source: "program", via });

  const pickWeek = (w: ProgramWeek) => {
    if (w.week === week.week) return;
    hapticSelection();
    setWeekNo(w.week);
    setDetails(false);
    // Land on today in the running week, on the first session elsewhere.
    setDayIndex(w.week === currentWeek ? todayDayIndex : Math.max(0, w.days.findIndex((d) => isTrainingDay(d))));
  };
  const makeRest = (scope: At["scope"]) => {
    hapticImpact("light");
    edit.mutate((plan) => setRest(plan, at(scope)));
    edited("rest", scope, "manual");
  };
  const remove = async (slug: string) => {
    hapticImpact("light");
    const label = await loadLabeller();
    const target = at();
    edit.mutate((plan) => removeBlock(plan, target, slug, label(slugsOf(plan, target.week, target.day).filter((s) => s !== slug))));
    edited("remove", "remaining", "manual");
  };

  return (
    <div className="space-y-3">
      {plannedAhead && (
        <div className="flex items-center gap-1" role="group" aria-label="Week">
          {weeks.map((w) => (
            <button
              key={w.week}
              type="button"
              aria-pressed={w.week === week.week}
              onClick={() => pickWeek(w)}
              className={cn(
                "press min-h-11 px-3 text-dense font-bold tabular-nums border-b-2 transition-colors",
                w.week === week.week ? "border-foreground/70 text-foreground" : "border-transparent text-muted-foreground/75",
              )}
            >
              Week {w.week}
            </button>
          ))}
        </div>
      )}

      <div ref={stripRef}>
        <WeekStrip
          week={week}
          selected={dayIndex}
          today={isCurrentWeek ? todayDayIndex : -1}
          logs={logs}
          onSelect={setDayIndex}
        />
      </div>

      <DaySessionCard
        key={`${week.week}-${dayIndex}`}
        program={program}
        week={week.week}
        dayIndex={dayIndex}
        isToday={isCurrentWeek && dayIndex === todayDayIndex}
        isCurrentWeek={isCurrentWeek}
        logs={logs}
        onLogged={onLogged}
        onSwap={canEdit ? (b) => setPicker({ current: b }) : undefined}
        onRemove={canEdit ? (slug) => void remove(slug) : undefined}
      >
        {rest && canRest && (
          <>
            <DoorRow label="Coach builds this day" sub={reach ?? "Pick the muscles, the minutes and the feel"} onClick={() => setBuilder(true)} />
            <DoorRow label="Build it myself" sub="Choose movements from the library" onClick={() => setPicker({})} />
          </>
        )}
        {!rest && canEdit && (
          <>
            <DoorRow label="Add exercise" sub={reach} onClick={() => setPicker({})} />
            {canRest && <DoorRow label="Make this a rest day" sub="This week only" onClick={() => makeRest("week")} />}
            {canRest && week.week < lastWeek && (
              <DoorRow label="Rest on this day every week" sub="From this week on" onClick={() => makeRest("remaining")} />
            )}
          </>
        )}
      </DaySessionCard>

      {(week.theme || week.progression_note || week.nutrition || week.recovery) && (
        <div>
          <button
            type="button"
            aria-expanded={details}
            onClick={() => setDetails((v) => !v)}
            className="press w-full min-h-11 inline-flex items-center justify-center gap-1 text-meta font-semibold text-muted-foreground"
          >
            {plannedAhead ? `Week ${week.week} details` : "Week details"}
            <ChevronDown size={12} className={cn("transition-transform", details && "rotate-180")} aria-hidden />
          </button>
          {details && (
            <div className="divide-y divide-border/35 border-t border-border/35">
              {week.theme && <FactRow k="Theme" v={week.theme} />}
              {week.progression_note && <FactRow k="Progress" v={week.progression_note} />}
              {week.nutrition && <FactRow k="Nutrition" v={nutritionLine(week.nutrition)} />}
              {week.recovery && <FactRow k="Recovery" v={recoveryLine(week.recovery)} />}
            </div>
          )}
        </div>
      )}

      <ExercisePickerSheet
        open={!!picker}
        onClose={() => setPicker(null)}
        title={picker?.current ? "Swap movement" : "Add a movement"}
        current={picker?.current?.slug ? { slug: picker.current.slug, name: picker.current.name } : null}
        exclude={(day?.blocks ?? []).map((b) => b.slug ?? "").filter(Boolean)}
        onPick={async (block, info) => {
          if (!picker) return;
          const current = picker.current;
          if (current?.slug) {
            edit.mutate((plan) => replaceBlock(plan, at(), current.slug!, block, info.sameKind));
            edited("swap", "remaining", "manual");
            return;
          }
          const label = await loadLabeller();
          const target = at();
          edit.mutate((plan) => addBlock(plan, target, block, label([...slugsOf(plan, target.week, target.day), block.slug])));
          edited(rest ? "train" : "add", "remaining", "manual");
        }}
      />
      <FocusSessionSheet
        open={builder}
        onClose={() => setBuilder(false)}
        title="Build this day"
        onUse={(built) => {
          edit.mutate((plan) => setTraining(plan, at(), { focus: built.focus, blocks: built.blocks }));
          edited("train", "remaining", "coach");
        }}
      />
    </div>
  );
};

export default ProgramWeekView;
