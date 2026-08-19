import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Flame, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedTheFireCTAProps {
  /** Accent color from current tribe tier */
  accent?: string;
  /** Optional tribe name — makes the ritual feel personal ("Feed The Real W") */
  tribeName?: string;
  className?: string;
}

/**
 * Pulsing CTA shown only when the current user hasn't checked in today.
 * Tap → /checkin. Disappears once they've checked in (until tomorrow).
 *
 * Premium "ritual" treatment: layered ember gradient, animated oxygen
 * intake spark, scrolling heat shimmer, and a hard kinetic chevron pull.
 */
const FeedTheFireCTA = ({ accent, tribeName, className }: FeedTheFireCTAProps) => {
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

  const c = accent ?? "hsl(var(--ember))";

  // Calm, single-purpose row — the old version pulsed, shimmered and threw
  // sparks, which read as cheap next to the rest of the page.
  return (
    <button
      onClick={() => navigate("/checkin")}
      className={cn(
        "relative w-full rounded-xl p-3 mb-4 border flex items-center gap-3 text-left",
        "transition-transform active:scale-[0.99]",
        className,
      )}
      style={{
        borderColor: c.replace(")", " / 0.45)"),
        background: `linear-gradient(135deg, ${c.replace(")", " / 0.10)")} 0%, hsl(var(--card) / 0.6) 100%)`,
      }}
    >
      <div
        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border"
        style={{
          background: c.replace(")", " / 0.12)"),
          borderColor: c.replace(")", " / 0.4)"),
        }}
      >
        <Flame size={18} style={{ color: c }} strokeWidth={2.4} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] font-black" style={{ color: c }}>
          Feed the fire
        </p>
        <p className="font-bold text-sm leading-tight truncate">
          {tribeName ? `Stoke ${tribeName} — check in today` : "Check in today → +1 to the fire"}
        </p>
      </div>

      <ChevronRight size={16} className="shrink-0" style={{ color: c }} strokeWidth={2.6} />
    </button>
  );
};

export default FeedTheFireCTA;
