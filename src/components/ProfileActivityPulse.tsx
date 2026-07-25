import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Activity, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileActivityPulseProps {
  userId: string;
}

const ProfileActivityPulse = ({ userId }: ProfileActivityPulseProps) => {
  const { data } = useQuery({
    queryKey: ["profile-activity-pulse", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", userId)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.checked_in_at || null;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  if (!data) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/50 bg-secondary/30">
        <Circle size={6} className="text-muted-foreground/50 fill-muted-foreground/50" />
        <span className="text-[10px] font-bold text-muted-foreground tracking-wide">No activity yet</span>
      </div>
    );
  }

  const lastCheckin = new Date(data);
  const hoursSince = (Date.now() - lastCheckin.getTime()) / (1000 * 60 * 60);
  const isActive = hoursSince < 24;
  const isWarm = hoursSince < 48;

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-sm",
      isActive && "border-xp-green/40 bg-xp-green/5",
      !isActive && isWarm && "border-amber-500/30 bg-amber-500/5",
      !isWarm && "border-border/50 bg-secondary/30",
    )}>
      {isActive ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-xp-green opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-xp-green" />
        </span>
      ) : (
        <Activity size={9} className={cn(isWarm ? "text-amber-400" : "text-muted-foreground/60")} />
      )}
      <span className={cn(
        "text-[10px] font-bold tracking-wide",
        isActive && "text-xp-green",
        !isActive && isWarm && "text-amber-400",
        !isWarm && "text-muted-foreground",
      )}>
        {isActive ? "Active today" : `Checked in ${formatDistanceToNow(lastCheckin, { addSuffix: true })}`}
      </span>
    </div>
  );
};

export default ProfileActivityPulse;
