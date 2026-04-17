import { useNavigate, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { getTierConfig, getNextTier, TIER_ORDER } from "@/lib/status-tiers";
import StatusAvatar from "@/components/StatusAvatar";
import { cn } from "@/lib/utils";
import { Crown, Clock, ChevronRight, Flame } from "lucide-react";
import { motion } from "framer-motion";

const PRESSURE_QUOTES = [
  "Grind never stops 🔥",
  "Discipline beats talent",
  "Level up or get left behind",
  "Stay hungry, stay humble",
  "Prove them wrong 🏆",
  "Consistency is king",
  "No excuses, only results",
  "Outwork everyone 💪",
  "Built different",
  "Earn your status",
  "Legends are made, not born",
  "Don't break now",
  "Most fail before this",
  "You're ahead — for now",
  "Others are catching up",
];

const HIDDEN_ROUTES = new Set([
  "/landing",
  "/auth",
  "/onboarding",
  "/apple-username",
  "/apple-auth-launch",
  "/paywall",
  "/reset-password",
  "/privacy",
  "/terms",
  "/ios-debug",
]);

const StatusHeader = () => {
  const { user, profile, isElite } = useAuth();
  const { isInTrial, daysRemaining, hoursRemaining } = useTrialAccess();
  const navigate = useNavigate();
  const location = useLocation();

  const dailyQuote = useMemo(() => {
    const today = new Date().toDateString();
    let hash = 0;
    for (let i = 0; i < today.length; i++) hash = ((hash << 5) - hash) + today.charCodeAt(i);
    return PRESSURE_QUOTES[Math.abs(hash) % PRESSURE_QUOTES.length];
  }, []);

  if (!user || !profile) return null;
  if (HIDDEN_ROUTES.has(location.pathname)) return null;
  if (
    location.pathname.startsWith("/oauth") ||
    location.pathname.startsWith("/callback") ||
    location.pathname.startsWith("/~oauth") ||
    location.pathname.startsWith("/u/")
  )
    return null;

  const tier = profile.status_tier || "recruit";
  const config = getTierConfig(tier);
  const next = getNextTier(tier);
  const streak = profile.streak || 0;

  // Tier progress: position within full hierarchy (0..1)
  const tierProgress = (TIER_ORDER.indexOf(tier as any) + 1) / TIER_ORDER.length;

  const trialUrgent = isInTrial && !isElite && daysRemaining <= 2;
  const trialLabel =
    daysRemaining > 1
      ? `${daysRemaining}d`
      : hoursRemaining > 1
      ? `${hoursRemaining}h`
      : "Last hours";

  // Per-tier accent gradient for the header glow
  const tierGlow =
    tier === "legend"
      ? "from-[hsl(280_70%_55%)]/25 via-gold/15 to-[hsl(350_80%_55%)]/20"
      : tier === "apex"
      ? "from-[hsl(18_95%_58%)]/25 via-gold/15 to-transparent"
      : tier === "elite"
      ? "from-gold/25 via-gold/10 to-transparent"
      : tier === "high_performer"
      ? "from-[hsl(var(--purple))]/20 via-[hsl(var(--purple))]/8 to-transparent"
      : tier === "performer"
      ? "from-[hsl(210_90%_56%)]/18 via-[hsl(210_90%_56%)]/6 to-transparent"
      : tier === "operator"
      ? "from-[hsl(var(--teal))]/15 via-[hsl(var(--teal))]/5 to-transparent"
      : "from-secondary/30 via-transparent to-transparent";

  const progressBarColor =
    tier === "legend"
      ? "bg-gradient-to-r from-[hsl(280_70%_60%)] via-gold to-[hsl(350_80%_60%)]"
      : tier === "apex"
      ? "bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold"
      : tier === "elite"
      ? "bg-gradient-to-r from-gold-dark to-gold"
      : tier === "high_performer"
      ? "bg-[hsl(var(--purple))]"
      : tier === "performer"
      ? "bg-[hsl(210_90%_56%)]"
      : tier === "operator"
      ? "bg-[hsl(var(--teal))]"
      : "bg-muted-foreground/40";

  return (
    <header className="sticky top-0 z-40 safe-top">
      {/* Animated tier-tinted backdrop */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none bg-gradient-to-b",
          tierGlow,
        )}
      />
      <div className="relative backdrop-blur-xl bg-background/55 border-b border-border/30">
        {/* Brand strip */}
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center justify-center gap-3 pt-2.5 pb-1 active:opacity-80 transition-opacity"
          aria-label="The W-Tracker — Home"
        >
          <img
            src="/app-icon.png"
            alt=""
            aria-hidden
            className="h-12 w-12 rounded-xl shadow-[0_4px_16px_hsl(42_78%_54%/0.45)]"
          />
          <span className="font-display text-lg font-black tracking-[0.14em] uppercase text-gradient-gold leading-none">
            The W-Tracker
          </span>
        </button>
        <p className="text-[11px] text-muted-foreground/80 italic font-medium text-center pb-1.5 px-3 truncate">
          {dailyQuote}
        </p>

        <div className="flex items-center gap-3 px-3 pt-1 pb-1.5">
          <button
            onClick={() => navigate("/profile")}
            className="shrink-0 active:scale-95 transition-transform"
            aria-label="Open profile"
          >
            <StatusAvatar
              src={profile.avatar_url}
              name={profile.username}
              tier={tier}
              size="md"
            />
          </button>

          <button
            onClick={() => navigate("/leaderboard")}
            className="flex-1 min-w-0 text-left active:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "text-[10px] uppercase tracking-[0.12em] font-bold leading-none",
                  config.textClass,
                )}
              >
                {config.label}
              </span>
              <span className="text-[9px] text-muted-foreground leading-none">
                · {config.percentile}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-sm font-black truncate leading-tight">
                @{profile.username}
              </p>
              {streak > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-[hsl(var(--orange,18_95%_58%))]">
                  <Flame size={10} className="text-[hsl(18_95%_58%)]" />
                  {streak}
                </span>
              )}
            </div>
          </button>

          <div className="shrink-0 flex items-center gap-1.5">
            {isElite ? (
              <motion.button
                onClick={() => navigate("/paywall")}
                className="relative flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-gold/20 via-gold/15 to-gold/20 border border-gold/60 shadow-[0_0_12px_hsl(42_78%_54%/0.5)]"
                whileTap={{ scale: 0.95 }}
                animate={{
                  boxShadow: [
                    "0 0 8px hsl(42 78% 54% / 0.4)",
                    "0 0 18px hsl(42 78% 54% / 0.7)",
                    "0 0 8px hsl(42 78% 54% / 0.4)",
                  ],
                }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <span
                  className="absolute -inset-0.5 rounded-full blur-md opacity-60 pointer-events-none"
                  style={{ background: "linear-gradient(135deg, hsl(42 78% 54% / 0.5), hsl(42 90% 65% / 0.3))" }}
                />
                <Crown size={11} className="relative text-gold drop-shadow-[0_0_4px_hsl(42_78%_54%/0.8)]" />
                <span className="relative text-[10px] font-black text-gold uppercase tracking-wider">
                  Elite
                </span>
              </motion.button>
            ) : isInTrial ? (
              <motion.button
                onClick={() => navigate("/paywall")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
                  trialUrgent
                    ? "bg-destructive/15 border-destructive/50 text-destructive"
                    : "bg-secondary/70 border-border text-foreground",
                )}
                whileTap={{ scale: 0.95 }}
                animate={trialUrgent ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1.8, repeat: Infinity }}
              >
                <Clock size={11} />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {trialLabel}
                </span>
              </motion.button>
            ) : null}
          </div>
        </div>

        {/* Progress to next tier */}
        <button
          onClick={() => navigate("/leaderboard")}
          className="w-full px-3 pb-1.5 active:opacity-80 transition-opacity"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
              {next ? `Next: ${next.label}` : "Apex of the hierarchy"}
            </span>
            <ChevronRight size={10} className="text-muted-foreground" />
          </div>
          <div className="h-1 rounded-full bg-secondary/60 overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", progressBarColor)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(6, tierProgress * 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </button>
      </div>
    </header>
  );
};

export default StatusHeader;
