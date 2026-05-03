import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CoachProgram, ProgramLog } from "@/hooks/use-coach-program";
import { cn } from "@/lib/utils";

interface Props {
  program: CoachProgram;
  currentWeek: number;
  logs: ProgramLog[];
}

const ProgramWeekAccordion = ({ program, currentWeek, logs }: Props) => {
  const [openWeek, setOpenWeek] = useState<number>(currentWeek);
  const [openDay, setOpenDay] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {program.ai_summary && (
        <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.08] to-card p-4">
          <p className="text-[10px] font-black tracking-[0.22em] uppercase text-gold mb-1">
            Coach's overview
          </p>
          <p className="text-sm text-foreground/85 leading-snug">{program.ai_summary}</p>
        </div>
      )}

      {program.plan_json.weeks.map((week) => {
        const open = openWeek === week.week;
        const isCurrent = week.week === currentWeek;
        return (
          <div
            key={week.week}
            className={cn(
              "rounded-2xl border overflow-hidden",
              isCurrent ? "border-gold/45 bg-gradient-to-b from-gold/[0.08] to-card"
                        : "border-border/60 bg-card/60",
            )}
          >
            <button
              type="button"
              onClick={() => setOpenWeek(open ? -1 : week.week)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-[10px] font-black tracking-[0.22em] uppercase text-gold">
                  Week {week.week}{isCurrent && " · Current"}
                </p>
                <p className="font-display text-base font-black tracking-tight">{week.theme}</p>
              </div>
              <ChevronDown
                size={18}
                className={cn("text-muted-foreground transition-transform", open && "rotate-180")}
              />
            </button>

            {open && (
              <div className="px-3 pb-4 space-y-2">
                {week.progression_note && (
                  <div className="rounded-xl border border-gold/25 bg-gold/[0.05] px-3 py-2 mb-1">
                    <p className="text-[9.5px] font-black uppercase tracking-widest text-gold mb-0.5">Progression</p>
                    <p className="text-[11.5px] text-foreground/85 leading-snug">{week.progression_note}</p>
                  </div>
                )}
                {week.days.map((day, di) => {
                  const isRest = day.focus.toLowerCase() === "rest";
                  const isLogged = logs.some(
                    (l) => l.week === week.week && l.day_index === di && l.completed,
                  );
                  const dayKey = `${week.week}-${di}`;
                  const dayOpen = openDay === dayKey;
                  return (
                    <div
                      key={dayKey}
                      className={cn(
                        "rounded-xl border",
                        isRest ? "border-border/40 bg-background/30" : "border-border/60 bg-background/50",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenDay(dayOpen ? null : dayKey)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                        disabled={isRest}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={cn(
                              "w-9 text-[10px] font-black tracking-widest uppercase",
                              isRest ? "text-muted-foreground" : "text-gold",
                            )}
                          >
                            {day.day}
                          </span>
                          <div className="min-w-0">
                            <p className={cn("text-sm font-bold truncate", isRest && "text-muted-foreground")}>
                              {day.focus}
                            </p>
                            {!isRest && (
                              <p className="text-[10px] text-muted-foreground">
                                {day.duration_min} min · {day.blocks.length} block{day.blocks.length !== 1 && "s"}
                              </p>
                            )}
                          </div>
                        </div>
                        {isLogged && (
                          <span className="text-[9px] font-black tracking-widest uppercase text-gold bg-gold/15 px-1.5 py-0.5 rounded-full border border-gold/30">
                            Done
                          </span>
                        )}
                      </button>
                      {!isRest && dayOpen && (
                        <ul className="px-3 pb-3 space-y-1.5">
                          {day.blocks.map((b, i) => (
                            <li
                              key={i}
                              className="rounded-lg bg-card/80 border border-border/40 px-2.5 py-2 text-[12px]"
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-bold">{b.name}</span>
                                <span className="text-[10.5px] font-black text-gold whitespace-nowrap">
                                  {b.sets}×{b.reps}{b.rpe ? ` @ RPE ${b.rpe}` : ""}
                                </span>
                              </div>
                              {b.notes && (
                                <p className="text-[10.5px] text-muted-foreground mt-0.5">{b.notes}</p>
                              )}
                            </li>
                          ))}
                          {day.conditioning && (
                            <li className="rounded-lg bg-card/80 border border-border/40 px-2.5 py-2 text-[11px] text-foreground/85">
                              <span className="text-[9.5px] font-black uppercase tracking-widest text-gold mr-1.5">
                                Conditioning
                              </span>
                              {day.conditioning}
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                    <p className="text-[9.5px] font-black uppercase tracking-widest text-gold mb-1">
                      Nutrition
                    </p>
                    <p className="text-[11.5px] leading-snug text-foreground/85">
                      Protein <b>{week.nutrition.protein_g_per_kg} g/kg</b> · {week.nutrition.daily_kcal_band}.
                      {week.nutrition.notes && <> {week.nutrition.notes}</>}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                    <p className="text-[9.5px] font-black uppercase tracking-widest text-gold mb-1">
                      Recovery
                    </p>
                    <p className="text-[11.5px] leading-snug text-foreground/85">
                      Sleep <b>{week.recovery.sleep_target_h} h</b> · mobility {week.recovery.mobility_min} min · {week.recovery.breathwork}.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProgramWeekAccordion;
