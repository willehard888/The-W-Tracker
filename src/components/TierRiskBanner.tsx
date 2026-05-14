import { AlertTriangle, Flame, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { TierRiskState } from "@/hooks/use-tier-risk";
import { useAthleteProfile, type ToneId } from "@/hooks/use-athlete-profile";

interface TierRiskBannerProps {
  risk: TierRiskState;
  className?: string;
}

/**
 * Tone-aware sub-copy bank. Indexed by `tone_pref` so the same risk reads
 * like the user's coach. Keep it short — banner is one line.
 */
const SUB_BY_TONE: Record<ToneId, { streak: string; status: string }> = {
  calm_mentor: {
    streak: "One log holds the line. You don't have to break here.",
    status: "Hold the floor — a single solid day buys back the buffer.",
  },
  drill_sergeant: {
    streak: "Get the log in. No debate. NOW.",
    status: "Don't drop. Show up. Pin the tier.",
  },
  scientist: {
    streak: "Skip cost ≈ multi-day setback. One log resets the trajectory.",
    status: "Cutoff narrow — a single quality day widens the margin.",
  },
  hype: {
    streak: "Don't break the chain. One log saves it. LET'S GO.",
    status: "Lock the tier. One big day pins it.",
  },
};

const TierRiskBanner = ({ risk, className }: TierRiskBannerProps) => {
  const navigate = useNavigate();
  const { profile } = useAthleteProfile();

  if (risk.level === "safe" || !risk.previousTierLabel) return null;

  const isDanger = risk.level === "danger";
  const isStreak = risk.reason === "streak";

  const headline = isStreak
    ? isDanger && (risk.hoursUntilStreakBreak ?? 0) <= 0
      ? `Streak about to break`
      : `Lose streak in ${risk.hoursUntilStreakBreak ?? 0}h ${risk.minutesUntilStreakBreak ?? 0}m`
    : `Lose ${risk.previousTierLabel ? "your" : ""} status`;

  // Coach-voiced sub-copy whenever the athlete has a tone_pref set. Falls
  // back to the original templated string for users who never onboarded
  // their Coach profile.
  const tone = (profile?.tone_pref ?? null) as ToneId | null;
  const fallbackSub = isStreak
    ? `Drop to ${risk.previousTierLabel} if you skip today`
    : `Only ${risk.pointsAboveCutoff?.toFixed(1) ?? "?"} pts above ${risk.previousTierLabel}`;
  const coachSub = tone
    ? SUB_BY_TONE[tone]?.[isStreak ? "streak" : "status"] ?? fallbackSub
    : fallbackSub;
  const sub = coachSub;

  return (
    <motion.button
      type="button"
      onClick={() => navigate("/checkin")}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "w-full text-left rounded-2xl border p-3.5 relative overflow-hidden active:scale-[0.99] transition-transform",
        isDanger
          ? "border-destructive/50 bg-destructive/8"
          : "border-gold/40 bg-gold/5",
        className,
      )}
      style={{
        boxShadow: isDanger
          ? "0 0 24px hsl(var(--destructive) / 0.2)"
          : "0 0 16px hsl(var(--gold) / 0.12)",
      }}
    >
      {isDanger && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse"
          style={{
            background: "radial-gradient(ellipse at left, hsl(var(--destructive) / 0.12), transparent 65%)",
          }}
        />
      )}

      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            isDanger ? "bg-destructive/15 text-destructive" : "bg-gold/15 text-gold",
          )}
        >
          {isDanger ? <AlertTriangle size={18} strokeWidth={2.5} /> : <Flame size={18} strokeWidth={2.5} />}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "font-display font-black text-sm uppercase tracking-wider truncate",
              isDanger ? "text-destructive" : "text-gold",
            )}
          >
            {headline}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{sub}</p>
        </div>

        <ChevronRight
          size={18}
          className={cn("shrink-0", isDanger ? "text-destructive/70" : "text-gold/70")}
        />
      </div>
    </motion.button>
  );
};

export default TierRiskBanner;
