import { useNavigate, useLocation } from "react-router-dom";
import StreakFlameInline from "@/components/StreakFlameInline";
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
      <div className="relative surface-glass hairline-bottom border-x-0 border-t-0 border-b-0 rounded-none">
        {/* Soft tier accent — single layer, low intensity */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 pointer-events-none bg-gradient-to-b opacity-50",
            tierGlow,
          )}
        />

        {/* Top hairline shimmer — flame-tinted for Apex */}
        <div className={cn(
          "pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          isApex ? "via-[hsl(18_95%_58%)]/70" : "via-gold/55",
        )} />

        {/* Bottom rim — only when user is hot (streak ≥ 7). Pulses with tier accent. */}
        {streak >= 7 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${
                isApex
                  ? "hsl(18 95% 58% / 0.85)"
                  : tier === "legend"
                  ? "hsl(280 70% 60% / 0.8)"
                  : tier === "elite"
                  ? "hsl(42 78% 54% / 0.8)"
                  : "hsl(18 92% 56% / 0.7)"
              } 50%, transparent 100%)`,
              animation: "flame-rim-pulse 4.5s ease-in-out infinite",
            }}
          />
        )}

        {/* Apex / Elite header — 2 rising amber embers along the bottom edge */}
        {(isApex || tier === "elite") && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-8 overflow-hidden">
            {[
              { left: "30%", delay: "0s",   color: isApex ? "hsl(18 95% 58%)" : "hsl(var(--gold-light))" },
              { left: "72%", delay: "1.8s", color: isApex ? "hsl(var(--gold))" : "hsl(var(--gold))" },
            ].map((e, i) => (
              <span
                key={i}
                className="absolute bottom-0 status-ember-rise rounded-full w-[2px] h-[2px]"
                style={{
                  left: e.left,
                  background: e.color,
                  boxShadow: `0 0 4px ${e.color}, 0 0 8px ${e.color}`,
                  animationDelay: e.delay,
                  animationDuration: "4.5s",
                }}
              />
            ))}
          </div>
        )}

        {/* Brand strip — minimal */}
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center justify-center gap-2 pt-2 pb-1.5 active:opacity-80 transition-opacity"
          aria-label="Whealth Factory — Home"
        >
          <BrandLogo size={28} alt="" className="rounded-md shadow-[0_2px_8px_hsl(42_78%_54%/0.5)]" />
          <span className="font-display font-black tracking-[0.22em] uppercase text-gradient-gold leading-none text-lg">
            Whealth Factory
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
                <StreakFlameInline streak={streak} suffix="" className="leading-none text-xs" />
              )}
            </div>

            {/* Row 2: tier label + next-tier CTA */}
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
              {tier !== "legend" && (() => {
                // Apex users → Legend requirements (invite-only Founders Circle)
                // Everyone else with a next tier → Apex paywall (skip the grind)
                const target = tier === "apex" ? "/profile?tier=legend" : "/paywall";
                const label = next ? next.label : "Legend";
                const isLegendTarget = tier === "apex";
                return (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(target);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(target);
                      }
                    }}
                    className={cn(
                      "inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-black leading-none whitespace-nowrap px-2 py-1 rounded-full border transition-all active:scale-95 cursor-pointer",
                      isLegendTarget
                        ? "text-gold border-gold/55 bg-gradient-to-r from-[hsl(280_70%_55%)]/15 via-gold/12 to-[hsl(350_80%_55%)]/15 hover:border-gold shadow-[0_0_8px_hsl(var(--gold)/0.30)]"
                        : "text-[hsl(18_95%_62%)] border-[hsl(18_95%_58%)]/50 bg-[hsl(18_95%_58%)]/10 hover:border-[hsl(18_95%_58%)] shadow-[0_0_6px_hsl(18_95%_58%/0.20)]",
                    )}
                    aria-label={isLegendTarget ? `View ${label} requirements` : "Skip the grind — Become Apex"}
                  >
                    → {label}
                    <ChevronRight size={9} />
                  </span>
                );
              })()}
            </div>

            {/* Row 3: progress bar — metallic */}
            <div className="h-[3px] rounded-full bg-secondary/70 overflow-hidden mt-1.5 shadow-[inset_0_1px_1px_hsl(0_0%_0%/0.3)]">
              <motion.div
                className={cn("h-full rounded-full relative", progressBarColor)}
                style={{ boxShadow: "inset 0 0.5px 0 hsl(0 0% 100% / 0.45)" }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(6, tierProgress * 100)}%` }}
                transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
              />
            </div>
          </button>

          {/* Status pill — Apex > Elite > Trial — calmer, luxurious */}
          {isApex ? (
            <div className="surface-metal shrink-0 relative flex items-center gap-1 px-2.5 py-1 rounded-full border border-[hsl(18_95%_58%)]/55 animate-breathe-soft">
              <Zap
                size={11}
                className="relative z-10 text-primary-foreground status-flame-flicker"
                strokeWidth={3}
                fill="currentColor"
              />
              <span className="relative z-10 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                {isApexSubscriber ? "Apex⚡" : "Apex"}
              </span>
            </div>
          ) : isElite ? (
            <div className="surface-metal shrink-0 relative flex items-center gap-1 px-2.5 py-1 rounded-full border border-gold/55 animate-breathe-soft">
              <Crown size={11} className="relative z-10 text-primary-foreground status-flame-flicker" />
              <span className="relative z-10 text-[10px] font-bold text-primary-foreground uppercase tracking-wider">
                Elite
              </span>
            </div>
          ) : isInTrial ? (
            <button
              onClick={() => navigate("/paywall")}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors active:scale-[0.96]",
                trialUrgent
                  ? "bg-destructive/15 border-destructive/50 text-destructive animate-scale-pulse"
                  : "bg-secondary/70 border-border text-foreground",
              )}
            >
              <Clock size={11} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {trialLabel}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default StatusHeader;
