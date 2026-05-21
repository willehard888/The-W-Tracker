import { useNavigate } from "react-router-dom";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import WeekStrip from "@/components/coach/WeekStrip";
import ProgramWeekAccordion from "@/components/coach/ProgramWeekAccordion";
import TodaySessionCard from "@/components/coach/TodaySessionCard";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { ProfileSkeleton as PageSkeleton } from "@/components/skeletons/PageSkeleton";

const CoachProgramDetail = () => {
  const navigate = useNavigate();
  const {
    isLoading,
    program,
    currentWeek,
    todayDayIndex,
    logs,
    refetch,
  } = useCoachProgram();

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2 border-b border-border/30">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--gold)/0.12)] flex items-center justify-center">
            <Dumbbell size={14} className="text-gold" />
          </div>
          <h1 className="font-display text-base font-black">Training program</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-4">
        {!program ? (
          <div className="rounded-2xl border border-border/40 bg-card/40 p-6 text-center">
            <p className="text-[13px] font-bold mb-1">No program yet</p>
            <p className="text-[11px] text-muted-foreground">
              Generate a 4-week program from the Coach landing.
            </p>
          </div>
        ) : (
          <>
            <TodaySessionCard
              program={program}
              currentWeek={currentWeek}
              todayDayIndex={todayDayIndex}
              logs={logs}
              onLogged={() => refetch()}
            />
            <WeekStrip
              program={program}
              currentWeek={currentWeek}
              todayDayIndex={todayDayIndex}
              logs={logs}
            />
            <ProgramWeekAccordion
              program={program}
              currentWeek={currentWeek}
              logs={logs}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default CoachProgramDetail;
