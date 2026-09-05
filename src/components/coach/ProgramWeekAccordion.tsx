import { isRestDay } from "@/lib/training/session";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CoachProgram, ProgramLog } from "@/hooks/use-coach-program";
import { cn } from "@/lib/utils";
import ExerciseRow from "@/components/coach/ExerciseRow";

interface Props {
  program: CoachProgram;
  currentWeek: number;
  logs: ProgramLog[];
}

const ProgramWeekAccordion = ({ program, currentWeek, logs }: Props) => {
  const [openWeek, setOpenWeek] = useState<number>(currentWeek);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showWeekDetails, setShowWeekDetails] = useState(false);

  return (
    <div className="space-y-3">
      {program.ai_summary && (
        <div className="rounded-2xl border border-gold/20 bg-card/60 p-3.5">
          <p className="text-[11px] font-black tracking-[0.22em] uppercase text-gold mb-1">Overview</p>
          <p className={cn("text-[12px] text-foreground/85 leading-snug", !showSummary && "line-clamp-2")}>
            {program.ai_summary}
          </p>
          {program.ai_summary.length > 120 && (
            <button
              type="button"
              onClick={() => setShowSummary(v => !v)}
              className="mt-1 text-[11px] font-black uppercase tracking-widest text-gold/80"
            >
              {showSummary ? "Less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {(program.plan_json.weeks ?? []).map((week) => {
        const open = openWeek === week.week;
        const isCurrent = week.week === currentWeek;
        return (
          <div
            key={week.week}
            className={cn(
              "relative rounded-2xl border overflow-hidden",
              isCurrent ? "border-gold/35 bg-card/70" : "border-border/50 bg-card/40",
            )}
          >
            {isCurrent && (
              <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-gold" />
            )}
            <button
              type="button"
              onClick={() => setOpenWeek(open ? -1 : week.week)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-black tracking-[0.22em] uppercase text-gold">Week {week.week}</p>
                <p className="font-display text-base font-black tracking-tight truncate">{week.theme}</p>
              </div>
              <ChevronDown
                size={18}
                className={cn("text-muted-foreground transition-transform shrink-0", open && "rotate-180")}
              />
            </button>

            {open && (
              <div className="px-3 pb-3 space-y-1.5">
                {week.progression_note && (
                  <p className="px-1 text-[12px] text-muted-foreground leading-snug">
                    {week.progression_note}
                  </p>
                )}
                {(week.days ?? []).map((day, di) => {
                  const isRest = isRestDay(day);
                  const isLogged = logs.some((l) => l.week === week.week && l.day_index === di && l.completed);
                  const dayKey = `${week.week}-${di}`;
                  const dayOpen = openDay === dayKey;
                  return (
                    <div
                      key={dayKey}
                      className={cn(
                        "rounded-xl border",
                        isRest ? "border-border/30 bg-background/20" : "border-border/50 bg-background/40",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenDay(dayOpen ? null : dayKey)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left"
                        disabled={isRest}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={cn(
                            "text-[11px] font-black tracking-widest uppercase w-8 shrink-0",
                            isRest ? "text-muted-foreground" : "text-gold",
                          )}>
                            {day.day}
                          </span>
                          <div className="min-w-0">
                            <p className={cn("text-[13px] font-bold truncate", isRest && "text-muted-foreground")}>
                              {day.focus}
                            </p>
                            {!isRest && (
                              <p className="text-[11px] text-muted-foreground">
                                {day.duration_min} min · {day.blocks?.length ?? 0} block{(day.blocks?.length ?? 0) !== 1 && "s"}
                              </p>
                            )}
                          </div>
                        </div>
                        {isLogged && (
                          <span className="text-[10px] font-black tracking-widest uppercase text-gold">Done</span>
                        )}
                      </button>
                      {!isRest && dayOpen && (
                        <ul className="px-3 pb-2.5 space-y-1">
                          {(day.blocks ?? []).map((b, i) => (
                            <ExerciseRow
                              key={i}
                              block={b as any}
                              programId={program.id}
                              week={week.week}
                              dayIndex={di}
                              loggable={week.week <= currentWeek}
                            />
                          ))}
                          {day.conditioning && (
                            <li className="text-[12px] text-foreground/80 pt-1">
                              <span className="text-[11px] font-black uppercase tracking-widest text-gold mr-1.5">Conditioning</span>
                              {day.conditioning}
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}

                {(week.nutrition || week.recovery) && (
                  <button
                    type="button"
                    onClick={() => setShowWeekDetails(v => !v)}
                    className="w-full text-[11px] font-black uppercase tracking-widest text-muted-foreground/70 inline-flex items-center justify-center gap-1 py-1.5"
                  >
                    Week details
                    <ChevronDown size={11} className={cn("transition-transform", showWeekDetails && "rotate-180")} />
                  </button>
                )}
                {showWeekDetails && (week.nutrition || week.recovery) && (
                  <div className="grid grid-cols-2 gap-2">
                    {week.nutrition && (
                      <div className="rounded-xl border border-border/40 bg-background/30 p-3">
                        <p className="text-[11px] font-black uppercase tracking-widest text-gold mb-1">Nutrition</p>
                        <p className="text-[12px] leading-snug text-foreground/85">
                          {week.nutrition.protein_g_per_kg != null && (
                            <>Protein <b>{week.nutrition.protein_g_per_kg} g/kg</b>{week.nutrition.daily_kcal_band ? " · " : ". "}</>
                          )}
                          {week.nutrition.daily_kcal_band ? <>{week.nutrition.daily_kcal_band}. </> : null}
                          {week.nutrition.notes && <>{week.nutrition.notes}</>}
                        </p>
                      </div>
                    )}
                    {week.recovery && (
                      <div className="rounded-xl border border-border/40 bg-background/30 p-3">
                        <p className="text-[11px] font-black uppercase tracking-widest text-gold mb-1">Recovery</p>
                        <p className="text-[12px] leading-snug text-foreground/85">
                          {week.recovery.sleep_target_h != null && <>Sleep <b>{week.recovery.sleep_target_h} h</b> · </>}
                          {week.recovery.mobility_min != null && <>mobility {week.recovery.mobility_min} min · </>}
                          {week.recovery.breathwork && <>{week.recovery.breathwork}.</>}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProgramWeekAccordion;
