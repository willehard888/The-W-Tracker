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

  const c = accent ?? "hsl(18 95% 58%)";

  return (
    <button
      onClick={() => navigate("/checkin")}
      className={cn(
        "relative w-full rounded-2xl p-4 mb-4 overflow-hidden border-2 flex items-center gap-3 text-left",
        "transition-all active:scale-[0.985] group",
        "[transform:translate3d(0,0,0)]",
        className,
      )}
      style={{
        borderColor: c.replace(")", " / 0.6)"),
        background: `
          radial-gradient(ellipse at 18% 120%, ${c.replace(")", " / 0.32)")} 0%, transparent 55%),
          radial-gradient(ellipse at 82% -20%, ${c.replace(")", " / 0.18)")} 0%, transparent 55%),
          linear-gradient(135deg, ${c.replace(")", " / 0.20)")} 0%, hsl(var(--card) / 0.78) 60%, ${c.replace(")", " / 0.12)")} 100%)
        `,
        boxShadow: `0 0 30px ${c.replace(")", " / 0.42)")}, inset 0 1px 0 hsl(0 0% 100% / 0.10), inset 0 -18px 36px -18px ${c.replace(")", " / 0.55)")}`,
        animation: "feed-fire-pulse 2.4s ease-in-out infinite",
      }}
    >
      {/* Animated diagonal heat shimmer */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background: `linear-gradient(110deg, transparent 28%, ${c.replace(")", " / 0.22)")} 50%, transparent 72%)`,
          backgroundSize: "300% 100%",
          animation: "shimmer-slide 3.5s linear infinite",
        }}
      />

      {/* Ember sparks rising from inside the CTA */}
      <span aria-hidden className="absolute inset-x-3 bottom-0 h-full pointer-events-none overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: 2 + (i % 2),
              height: 2 + (i % 2),
              left: `${15 + i * 22}%`,
              bottom: -2,
              background: c,
              boxShadow: `0 0 8px ${c}`,
              opacity: 0,
              animation: `feed-cta-spark ${3.2 + i * 0.4}s ease-out ${i * 0.55}s infinite`,
              mixBlendMode: "screen",
            }}
          />
        ))}
      </span>

      {/* Flame icon block — heat halo + breathing oxygen ring */}
      <div
        className="relative h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border"
        style={{
          background: `radial-gradient(circle at 50% 80%, ${c.replace(")", " / 0.45)")} 0%, ${c.replace(")", " / 0.10)")} 70%)`,
          borderColor: c.replace(")", " / 0.55)"),
          boxShadow: `0 0 18px ${c.replace(")", " / 0.6)")}, inset 0 0 12px ${c.replace(")", " / 0.35)")}`,
        }}
      >
        {/* Outer breathing oxygen ring */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl"
          style={{
            border: `1px solid ${c.replace(")", " / 0.4)")}`,
            animation: "feed-cta-oxygen 2.2s ease-in-out infinite",
          }}
        />
        <Flame
          size={22}
          style={{ color: c, filter: `drop-shadow(0 0 8px ${c})` }}
          strokeWidth={2.4}
        />
      </div>

      <div className="relative flex-1 min-w-0">
        <p
          className="text-[10px] uppercase tracking-[0.22em] font-black mb-0.5 flex items-center gap-1.5"
          style={{ color: c }}
        >
          <span
            className="inline-block h-1 w-1 rounded-full animate-pulse"
            style={{ background: c, boxShadow: `0 0 6px ${c}` }}
          />
          Feed the fire
        </p>
        <p className="font-display font-black text-base leading-tight">
          {tribeName ? `Stoke ${tribeName}` : "Add today's day → +1 to the fire"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Skip and your tribe's flame stops growing
        </p>
      </div>

      {/* Hard chevron — physical pull-forward feel */}
      <div
        className="relative shrink-0 h-8 w-8 rounded-full flex items-center justify-center border transition-transform group-active:translate-x-0 group-hover:translate-x-0.5"
        style={{
          borderColor: c.replace(")", " / 0.55)"),
          background: c.replace(")", " / 0.18)"),
          boxShadow: `0 0 10px ${c.replace(")", " / 0.5)")}`,
        }}
      >
        <ChevronRight size={18} style={{ color: c }} strokeWidth={3} />
      </div>
    </button>
  );
};

export default FeedTheFireCTA;
