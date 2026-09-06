import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import { CoachProgram, ProgramLog, ProgramWeek } from "@/hooks/use-coach-program";
import { daySummary, isRestDay } from "@/lib/training/session";
import { cn } from "@/lib/utils";
import { DoorRow, FactRow } from "@/components/coach/rows";
import ExerciseRow from "@/components/coach/ExerciseRow";

interface Props {
  program: CoachProgram;
  currentWeek: number;
  logs: ProgramLog[];
}

const LABEL = "text-[11px] font-bold text-muted-foreground";

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
 * others are hairline rows, and inside a week the days are hairline rows too,
 * a rest day being nothing more than its line.
 */
const ProgramWeekAccordion = ({ program, currentWeek, logs }: Props) => {
  const [openWeek, setOpenWeek] = useState<number>(currentWeek);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [showWeekDetails, setShowWeekDetails] = useState(false);
  const navigate = useNavigate();

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
              <span className="flex-1 min-w-0 block text-[14px] font-semibold leading-tight truncate">
                Week {week.week}{week.theme ? ` · ${week.theme}` : ""}
              </span>
              <ChevronDown
                size={16}
                className={cn("text-muted-foreground/60 shrink-0 transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </button>

            {open && (
              <div className="pb-3">
                {week.progression_note && (
                  <p className="mb-1 text-[12px] text-muted-foreground leading-snug">
                    {week.progression_note}
                  </p>
                )}
                <ul className="divide-y divide-border/35">
                  {(week.days ?? []).map((day, di) => {
                    const dayKey = `${week.week}-${di}`;
                    if (isRestDay(day)) {
                      return (
                        <li key={dayKey} className="py-2.5 flex items-center gap-3 text-[13px] text-muted-foreground">
                          <span className={cn(LABEL, "w-8 shrink-0")}>{day.day}</span>
                          Rest
                        </li>
                      );
                    }
                    const isLogged = logs.some((l) => l.week === week.week && l.day_index === di && l.completed);
                    const inProgress = logs.some((l) => l.week === week.week && l.day_index === di && !l.completed && l.status === "in_progress");
                    const dayOpen = openDay === dayKey;
                    return (
                      <li key={dayKey}>
                        <button
                          type="button"
                          onClick={() => setOpenDay(dayOpen ? null : dayKey)}
                          className="press w-full min-h-11 flex items-center gap-3 py-2.5 text-left"
                        >
                          <span className={cn(LABEL, "w-8 shrink-0")}>{day.day}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-semibold leading-tight truncate">{day.focus}</span>
                            <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{daySummary(day)}</span>
                          </span>
                          {isLogged && <Check size={14} className="text-xp-green shrink-0" role="img" aria-label="Done" />}
                          <ChevronDown
                            size={14}
                            className={cn("text-muted-foreground/60 shrink-0 transition-transform", dayOpen && "rotate-180")}
                            aria-hidden
                          />
                        </button>
                        {dayOpen && (
                          <ul className="pb-2 space-y-1">
                            {(day.blocks ?? []).map((b, i) => (
                              <ExerciseRow
                                key={i}
                                block={b}
                                programId={program.id}
                                week={week.week}
                                dayIndex={di}
                                loggable={week.week <= currentWeek}
                              />
                            ))}
                            {day.conditioning && (
                              <li className="pt-1 text-[12px] text-foreground/80">
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
                      onClick={() => setShowWeekDetails(v => !v)}
                      className="press w-full min-h-11 inline-flex items-center justify-center gap-1 text-[12px] font-semibold text-muted-foreground"
                    >
                      Week details
                      <ChevronDown size={12} className={cn("transition-transform", showWeekDetails && "rotate-180")} aria-hidden />
                    </button>
                    {showWeekDetails && (
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
    </div>
  );
};

export default ProgramWeekAccordion;
