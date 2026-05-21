import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PerformanceOSDashboard from "@/components/coach/PerformanceOSDashboard";
import ProgressDashboard from "@/components/coach/ProgressDashboard";
import { useCoachProgram } from "@/hooks/use-coach-program";

const CoachProgress = () => {
  const navigate = useNavigate();
  const { program, currentWeek, logs } = useCoachProgram();

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2 border-b border-border/30">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--gold)/0.12)] flex items-center justify-center">
            <BarChart3 size={14} className="text-gold" />
          </div>
          <h1 className="font-display text-base font-black">Weekly review</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-4">
        <PerformanceOSDashboard />
        {program && (
          <ProgressDashboard
            program={program}
            currentWeek={currentWeek}
            logs={logs}
          />
        )}
      </div>
    </div>
  );
};

export default CoachProgress;
