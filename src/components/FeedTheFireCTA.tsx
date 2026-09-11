import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLastCheckin } from "@/hooks/use-last-checkin";
import { useCheckinDay } from "@/hooks/use-checkin-day";
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
  // The shared cache + the shared day rule. This used to answer "checked in
  // today?" with its own uncached one-shot query, so after a check-in
  // elsewhere the CTA kept saying "feed the fire" until remount (nothing
  // invalidated it), and its startOfDay went stale across midnight.
  const { data: lastCheckin, isPending } = useLastCheckin(profile?.user_id);
  const { canCheckin } = useCheckinDay(lastCheckin?.checked_in_at);

  if (isPending || !canCheckin) return null;

  const c = accent ?? "hsl(var(--ember))";

  // Calm, single-purpose row — the old version pulsed, shimmered and threw
  // sparks, which read as cheap next to the rest of the page.
  return (
    <button
      onClick={() => navigate("/checkin")}
      className={cn(
        "relative w-full rounded-xl p-3 mb-4 border flex items-center gap-3 text-left",
        "transition-transform ",
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
        <Flame aria-hidden size={18} style={{ color: c }} strokeWidth={2.4} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-muted-foreground" style={{ color: c }}>
          Feed the fire
        </p>
        <p className="font-bold text-sm leading-tight truncate">
          {tribeName ? `Stoke ${tribeName} — check in today` : "Check in today → +1 to the fire"}
        </p>
      </div>

      <ChevronRight aria-hidden size={16} className="shrink-0" style={{ color: c }} strokeWidth={2.6} />
    </button>
  );
};

export default FeedTheFireCTA;
