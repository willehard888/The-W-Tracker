import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import { useEditProgram, type CoachProgram, type ProgramBlock, type ProgramLog, type ProgramWeek } from "@/hooks/use-coach-program";
import { loadEngine } from "@/hooks/use-focus-session";
import { daySummary, isRestDay } from "@/lib/training/session";
import { addBlock, removeBlock, replaceBlock, setRest, setTraining, type At } from "@/lib/training/plan-edit";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { track, FUNNEL } from "@/lib/analytics";
import { DoorRow, FactRow } from "@/components/coach/rows";
import ExerciseRow from "@/components/coach/ExerciseRow";
import ExercisePickerSheet from "@/components/coach/ExercisePickerSheet";
import FocusSessionSheet from "@/components/coach/FocusSessionSheet";

interface Props {
  program: CoachProgram;
  currentWeek: number;
  logs: ProgramLog[];
}

const LABEL = "text-label font-bold text-muted-foreground";

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
 * The whole block, week by week. Only the current week is a surface; the
 * others are hairline rows, and inside a week the days are hairline rows too.
 *
 * The plan bends by hand: a rest day opens to "Coach builds this day" or
 * "Build it myself"; a training day takes a new movement, swaps or drops one,
 * or becomes a rest day (this week, or from here on). Edits reach this week
 * and the later ones; the past, a finished day and a movement with sets
 * already logged are never touched.
 */
/** The day's name from the muscles it mostly trains, by the engine's own map. */
const labelFor = async (slugs: (string | null | undefined)[]) => {
  const e = await loadEngine();
  return e.focusLabel(e.primaryFocuses(slugs.filter((x): x is string => !!x)));
};

const ProgramWeekAccordion = ({ program, currentWeek, logs }: Props) => {
  const [openWeek, setOpenWeek] = useState<number>(currentWeek);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [detailsWeek, setDetailsWeek] = useState<number | null>(null);
  const [picker, setPicker] = useState<{ week: number; day: number; current?: ProgramBlock } | null>(null);
  const [builder, setBuilder] = useState<{ week: number; day: number } | null>(null);
  const navigate = useNavigate();
  const edit = useEditProgram(program);
  const lastWeek = Math.max(...(program.plan_json.weeks ?? []).map((w) => w.week), 1);

  const at = (week: number, day: number, scope: At["scope"] = "remaining"): At => ({ week, day, scope });
  const dayAt = (week: number, day: number) => program.plan_json.weeks.find((w) => w.week === week)?.days[day];
  const edited = (op: string, scope: At["scope"], via: "coach" | "manual") =>
    void track(FUNNEL.programEdited, { op, scope, source: "program", via });

  const rest = (week: number, day: number, scope: At["scope"]) => {
    hapticImpact("light");
    edit.mutate((plan) => setRest(plan, at(week, day, scope)));
    setOpenDay(null);
    edited("rest", scope, "manual");
  };
  const remove = async (week: number, day: number, slug: string) => {
    hapticImpact("light");
    const label = await labelFor((dayAt(week, day)?.blocks ?? []).filter((b) => b.slug !== slug).map((b) => b.slug));
    edit.mutate((plan) => removeBlock(plan, at(week, day), slug, label));
    edited("remove", "remaining", "manual");
  };

  return (
    <div>
      {(program.plan_json.weeks ?? []).map((week) => {
        const open = openWeek === week.week;
        const isCurrent = week.week === currentWeek;
        return (
          <section
            key={week.week}
            className={isCurrent ? "surface-card surface-card-quiet px-4 my-2" : "border-t border-border/35"}
          >
            <button
              type="button"
              onClick={() => setOpenWeek(open ? -1 : week.week)}
              className="press w-full min-h-11 flex items-center gap-3 py-3 text-left"
            >
              <span className="flex-1 min-w-0 block text-note font-semibold leading-tight truncate">
                Week {week.week}{week.theme ? ` · ${week.theme}` : ""}
              </span>
              <ChevronDown
                size={16}
                className={cn("text-muted-foreground/75 shrink-0 transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </button>

            {open && (
              <div className="pb-3">
                {week.progression_note && (
                  <p className="mb-1 text-meta text-muted-foreground leading-snug">
                    {week.progression_note}
                  </p>
                )}
                <ul className="divide-y divide-border/35">
                  {(week.days ?? []).map((day, di) => {
                    const dayKey = `${week.week}-${di}`;
                    const isLogged = logs.some((l) => l.week === week.week && l.day_index === di && l.completed);
                    const inProgress = logs.some((l) => l.week === week.week && l.day_index === di && !l.completed && l.status === "in_progress");
                    const dayOpen = openDay === dayKey;
                    // The past and a finished day are history; a day under way keeps its shape.
                    const canEdit = week.week >= currentWeek && !isLogged;
                    const canRest = canEdit && !inProgress;
                    if (isRestDay(day)) {
                      return (
                        <li key={dayKey}>
                          <button
                            type="button"
                            disabled={!canRest}
                            onClick={() => setOpenDay(dayOpen ? null : dayKey)}
                            className="press w-full min-h-11 flex items-center gap-3 py-2.5 text-left text-dense text-muted-foreground"
                          >
                            <span className={cn(LABEL, "w-8 shrink-0")}>{day.day}</span>
                            <span className="flex-1">Rest</span>
                            {canRest && (
                              <ChevronDown size={14} className={cn("text-muted-foreground/75 shrink-0 transition-transform", dayOpen && "rotate-180")} aria-hidden />
                            )}
                          </button>
                          {dayOpen && canRest && (
                            <div className="pb-2 divide-y divide-border/35 border-t border-border/35">
                              <DoorRow label="Coach builds this day" sub="Pick the muscles, the minutes and the feel" onClick={() => setBuilder({ week: week.week, day: di })} />
                              <DoorRow label="Build it myself" sub="Choose movements from the library" onClick={() => setPicker({ week: week.week, day: di })} />
                            </div>
                          )}
                        </li>
                      );
                    }
                    return (
                      <li key={dayKey}>
                        <button
                          type="button"
                          onClick={() => setOpenDay(dayOpen ? null : dayKey)}
                          className="press w-full min-h-11 flex items-center gap-3 py-2.5 text-left"
                        >
                          <span className={cn(LABEL, "w-8 shrink-0")}>{day.day}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-dense font-semibold leading-tight truncate">{day.focus}</span>
                            <span className="block text-meta text-muted-foreground leading-snug mt-0.5">{daySummary(day)}</span>
                          </span>
                          {isLogged && <Check size={14} className="text-xp-green shrink-0" role="img" aria-label="Done" />}
                          <ChevronDown
                            size={14}
                            className={cn("text-muted-foreground/75 shrink-0 transition-transform", dayOpen && "rotate-180")}
                            aria-hidden
                          />
                        </button>
                        {dayOpen && (
                          <ul className="pb-2 space-y-1">
                            {(day.blocks ?? []).map((b, i) => (
                              <ExerciseRow
                                key={b.slug ?? i}
                                block={b}
                                programId={program.id}
                                week={week.week}
                                dayIndex={di}
                                loggable={week.week <= currentWeek}
                                onSwap={canEdit && b.slug ? () => setPicker({ week: week.week, day: di, current: b }) : undefined}
                                onRemove={canEdit && b.slug ? () => void remove(week.week, di, b.slug!) : undefined}
                              />
                            ))}
                            {day.conditioning && (
                              <li className="pt-1 text-meta text-foreground/80">
                                <span className={cn(LABEL, "mr-1.5")}>Conditioning</span>
                                {day.conditioning}
                              </li>
                            )}
                            {/* The runner used to open only from today's card, so a
                                session on any other day of the week had no way in. */}
                            {isCurrent && !isLogged && (
                              <li className="border-t border-border/35">
                                <DoorRow label={inProgress ? "Continue this session" : "Start this session"} onClick={() => navigate(`/coach/session/${week.week}/${di}`)} />
                              </li>
                            )}
                            {canEdit && (
                              <li className="border-t border-border/35 divide-y divide-border/35">
                                <DoorRow label="Add exercise" onClick={() => setPicker({ week: week.week, day: di })} />
                                {canRest && <DoorRow label="Rest this week" onClick={() => rest(week.week, di, "week")} />}
                                {canRest && week.week < lastWeek && (
                                  <DoorRow label="Rest every week from here" onClick={() => rest(week.week, di, "remaining")} />
                                )}
                              </li>
                            )}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {(week.nutrition || week.recovery) && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDetailsWeek((w) => (w === week.week ? null : week.week))}
                      className="press w-full min-h-11 inline-flex items-center justify-center gap-1 text-meta font-semibold text-muted-foreground"
                    >
                      Week details
                      <ChevronDown size={12} className={cn("transition-transform", detailsWeek === week.week && "rotate-180")} aria-hidden />
                    </button>
                    {detailsWeek === week.week && (
                      <div className="divide-y divide-border/35 border-t border-border/35">
                        {week.nutrition && <FactRow k="Nutrition" v={nutritionLine(week.nutrition)} />}
                        {week.recovery && <FactRow k="Recovery" v={recoveryLine(week.recovery)} />}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}

      <ExercisePickerSheet
        open={!!picker}
        onClose={() => setPicker(null)}
        title={picker?.current ? "Swap movement" : "Add a movement"}
        current={picker?.current?.slug ? { slug: picker.current.slug, name: picker.current.name } : null}
        exclude={(picker ? dayAt(picker.week, picker.day)?.blocks ?? [] : []).map((b) => b.slug ?? "").filter(Boolean)}
        onPick={async (block, info) => {
          if (!picker) return;
          const { week, day, current } = picker;
          if (current?.slug) {
            edit.mutate((plan) => replaceBlock(plan, at(week, day), current.slug!, block, info.sameKind));
            edited("swap", "remaining", "manual");
            return;
          }
          const before = dayAt(week, day);
          const label = await labelFor([...(before?.blocks ?? []).map((b) => b.slug), block.slug]);
          edit.mutate((plan) => addBlock(plan, at(week, day), block, label));
          edited(before && isRestDay(before) ? "train" : "add", "remaining", "manual");
        }}
      />
      <FocusSessionSheet
        open={!!builder}
        onClose={() => setBuilder(null)}
        title="Build this day"
        onUse={(built) => {
          if (!builder) return;
          edit.mutate((plan) => setTraining(plan, at(builder.week, builder.day), { focus: built.focus, blocks: built.blocks }));
          setOpenDay(`${builder.week}-${builder.day}`);
          edited("train", "remaining", "coach");
        }}
      />
    </div>
  );
};

export default ProgramWeekAccordion;
