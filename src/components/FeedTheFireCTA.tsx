import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedTheFireCTAProps {
  /** Accent color from current tribe tier */
  accent?: string;
  className?: string;
}

/**
 * Pulsing CTA shown only when the current user hasn't checked in today.
 * Tap → /checkin. Disappears once they've checked in (until tomorrow).
 */
const FeedTheFireCTA = ({ accent, className }: FeedTheFireCTAProps) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [checkedToday, setCheckedToday] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!profile?.user_id) return;
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("daily_checkins")
        .select("id")
        .eq("user_id", profile.user_id)
        .gte("checked_in_at", startOfDay.toISOString())
        .limit(1);
      if (alive) setCheckedToday((data ?? []).length > 0);
    };
    run();
    return () => {
      alive = false;
    };
  }, [profile?.user_id]);

  if (checkedToday === null || checkedToday === true) return null;

  const c = accent ?? "hsl(18 95% 58%)";

  return (
    <button
      onClick={() => navigate("/checkin")}
      className={cn(
        "relative w-full rounded-2xl p-4 mb-4 overflow-hidden border-2 flex items-center gap-3 text-left transition-transform active:scale-[0.99] group",
        className,
      )}
      style={{
        borderColor: c.replace(")", " / 0.6)"),
        background: `linear-gradient(135deg, ${c.replace(")", " / 0.18)")} 0%, hsl(var(--card) / 0.7) 60%, ${c.replace(")", " / 0.10)")} 100%)`,
        boxShadow: `0 0 28px ${c.replace(")", " / 0.4)")}, inset 0 1px 0 hsl(0 0% 100% / 0.08)`,
        animation: "feed-fire-pulse 2.4s ease-in-out infinite",
      }}
    >
      {/* Animated gradient sweep */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background: `linear-gradient(110deg, transparent 30%, ${c.replace(")", " / 0.18)")} 50%, transparent 70%)`,
          backgroundSize: "300% 100%",
          animation: "shimmer-slide 3.5s linear infinite",
        }}
      />
      <div
        className="relative h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border"
        style={{
          background: `linear-gradient(135deg, ${c.replace(")", " / 0.30)")}, ${c.replace(")", " / 0.10)")})`,
          borderColor: c.replace(")", " / 0.5)"),
          boxShadow: `0 0 14px ${c.replace(")", " / 0.5)")}`,
        }}
      >
        <Flame size={22} style={{ color: c, filter: `drop-shadow(0 0 6px ${c})` }} strokeWidth={2.4} />
      </div>
      <div className="relative flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-black mb-0.5" style={{ color: c }}>
          Feed the fire
        </p>
        <p className="font-display font-black text-base leading-tight">
          Add today's day → +1 to the fire
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Skip and your tribe's flame stops growing
        </p>
      </div>
    </button>
  );
};

export default FeedTheFireCTA;
