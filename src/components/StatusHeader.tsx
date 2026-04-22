import { useNavigate, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { getTierConfig, getNextTier, TIER_ORDER } from "@/lib/status-tiers";
import StatusAvatar from "@/components/StatusAvatar";
import { cn } from "@/lib/utils";
import { Crown, Clock, ChevronRight, Flame, Zap } from "lucide-react";
import { motion } from "framer-motion";
import BrandLogo from "@/components/BrandLogo";

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
  const isApex = tier === "apex";
  const isApexSubscriber = (profile as any).is_apex_subscriber === true;

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
      ? "from-[hsl(18_95%_58%)]/35 via-gold/20 to-[hsl(18_95%_58%)]/15"
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
      {/* Tier-tinted backdrop glow */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none bg-gradient-to-b opacity-90",
          tierGlow,
        )}
      />
      {/* Subtle radial spotlight */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, hsl(42 78% 54% / 0.16), transparent 65%)",
        }}
      />

      <div className="relative backdrop-blur-xl bg-background/90 border-b border-gold/20">
        {/* Top shimmer accent */}
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

        {/* Brand strip — minimal */}
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center justify-center gap-2 pt-2 pb-1.5 active:opacity-80 transition-opacity"
          aria-label="The W-Tracker — Home"
        >
          <BrandLogo size={28} alt="" className="rounded-md shadow-[0_2px_8px_hsl(42_78%_54%/0.5)]" />
          <span className="font-display font-black tracking-[0.22em] uppercase text-gradient-gold leading-none text-lg">
            The W-Tracker
          </span>
        </button>

        {/* Single status row: avatar + identity + tier progress + pill */}
        <div className="flex items-center gap-3 px-3 pb-2.5">
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
            {/* Row 1: name + streak */}
            <div className="flex items-center gap-2">
              <p className="text-base font-black truncate leading-none">
                @{profile.username}
              </p>
              {streak > 0 && (
                <span className="flex items-center gap-0.5 text-xs font-black text-[hsl(18_95%_58%)] leading-none">
                  <Flame size={12} />
                  {streak}
                </span>
              )}
            </div>

            {/* Row 2: tier label + next */}
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[0.16em] font-black leading-none",
                    config.textClass,
                  )}
                >
                  {config.label}
                </span>
                <span className="text-[10px] text-muted-foreground/70 leading-none">
                  · {config.percentile}
                </span>
              </div>
              <span className="flex items-center gap-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/70 font-bold leading-none whitespace-nowrap">
                {next ? `→ ${next.label}` : "Apex"}
                <ChevronRight size={9} />
              </span>
            </div>

            {/* Row 3: progress bar */}
            <div className="h-1 rounded-full bg-secondary/60 overflow-hidden mt-1.5">
              <motion.div
                className={cn("h-full rounded-full", progressBarColor)}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(6, tierProgress * 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </button>

          {/* Status pill */}
          {isElite ? (
            <motion.div
              className="shrink-0 relative flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-gold/20 via-gold/15 to-gold/20 border border-gold/60"
              animate={{
                boxShadow: [
                  "0 0 8px hsl(42 78% 54% / 0.4)",
                  "0 0 18px hsl(42 78% 54% / 0.7)",
                  "0 0 8px hsl(42 78% 54% / 0.4)",
                ],
              }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Crown size={11} className="text-gold drop-shadow-[0_0_4px_hsl(42_78%_54%/0.8)]" />
              <span className="text-[10px] font-black text-gold uppercase tracking-wider">
                Elite
              </span>
            </motion.div>
          ) : isInTrial ? (
            <motion.button
              onClick={() => navigate("/paywall")}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
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
    </header>
  );
};

export default StatusHeader;
