import { useNavigate, useLocation } from "react-router-dom";
import StreakFlameInline from "@/components/StreakFlameInline";
import TierUsername from "@/components/TierUsername";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { getEffectiveStreak } from "@/lib/streak";
import { pickDaily } from "@/lib/daily-rotation";
import { getTierConfig, getNextTier, TIER_ORDER, formatTier, topShareLabel, canonicalTier } from "@/lib/status-tiers";
import { useMyRank } from "@/hooks/use-my-rank";
import StatusAvatar from "@/components/StatusAvatar";
import { cn } from "@/lib/utils";
import { Crown, Clock, ChevronRight, Flame, Zap } from "lucide-react";
import { motion } from "framer-motion";
import BrandLogo from "@/components/BrandLogo";

// Voice matches the tier `message` strings in status-tiers.ts — quiet, earned,
// premium restraint. Not gym-bro hustle clichés (which read cheap at the very
// top of the app, refreshed daily).
const PRESSURE_QUOTES = [
  "Discipline is the new flex",
  "Show up before you feel like it",
  "The work is the reward",
  "Quiet consistency, loud results",
  "Earned, never given",
  "Standards over motivation",
  "Prove it to yourself",
  "One honest day at a time",
  "Depth over noise",
  "Your standard is the ceiling",
  "Small reps, compounded",
  "Keep the chain unbroken",
  "Become undeniable",
  "The rare few finish",
  "Let the streak speak",
];

const HIDDEN_ROUTES = new Set([
  "/landing",
  "/auth",
  "/onboarding",
  "/apple-username",
  "/choose-username",
  "/apple-auth-launch",
  "/paywall",
  "/reset-password",
  "/privacy",
  "/terms",
  "/ios-debug",
  // Check-in is a focused full-screen flow with its own header/back — the
  // global brand bar on top was a double header eating vertical space.
  "/checkin",
  // NOTE: /profile is NOT hidden — it gets the sticky brand strip like every
  // other tab (identity row stays Home/Leaderboard-only via showIdentity, so
  // the hero below is still the single identity block).
]);

const StatusHeader = () => {
  const { user, profile, isElite } = useAuth();
  const { isInTrial, daysRemaining, hoursRemaining } = useTrialAccess();
  const navigate = useNavigate();
  const location = useLocation();
  // Live rank — the SAME get_user_rank source and shared cache every other
  // surface uses, so the header can never contradict the profile nameplate.
  const { data: rankData } = useMyRank(profile?.user_id);

  // Keyed on the local date so the quote actually rotates at midnight — with
  // empty deps it was frozen for the whole session (app left open overnight
  // showed yesterday's quote indefinitely).
  const quoteDay = new Date().toDateString();
  const dailyQuote = useMemo(() => pickDaily(PRESSURE_QUOTES), [quoteDay]);

  // Last check-in drives the EFFECTIVE streak so the header resets the moment
  // a calendar day is missed — not only after a late check-in. Same query key
  // as Index so React Query dedupes it (no extra request).
  const { data: lastCheckin } = useQuery({
    queryKey: ["last-checkin", profile?.user_id],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      if (!profile) return null;
      const { data } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", profile.user_id)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.user_id,
  });

  if (!user || !profile) return null;
  if (HIDDEN_ROUTES.has(location.pathname)) return null;
  if (
    location.pathname.startsWith("/oauth") ||
    location.pathname.startsWith("/callback") ||
    location.pathname.startsWith("/~oauth") ||
    location.pathname.startsWith("/u/")
  )
    return null;

  // Canonical id — legacy 'normal' rows must behave exactly like recruit in
  // every ladder computation below (indexOf on the raw value returned -1).
  const tier = canonicalTier(profile.status_tier);
  const division = (profile as any).tier_division ?? 0;
  const config = getTierConfig(tier);
  const next = getNextTier(tier);
  const streak = getEffectiveStreak(profile.streak || 0, lastCheckin?.checked_in_at);
  const isApex = tier === "apex";
  const isApexSubscriber = (profile as any).is_apex_subscriber === true;

  // Tier progress: position within full hierarchy (0..1)
  const tierProgress = (TIER_ORDER.indexOf(tier as any) + 1) / TIER_ORDER.length;

  // The trial is a GIFT (full access), not a countdown to doom — and since the
  // hard paywall is off, "expiry" isn't a hard cliff. Only flag the very last
  // day as time-sensitive; otherwise present it as the premium state it is.
  const trialUrgent = isInTrial && !isElite && daysRemaining <= 1;
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
      ? "from-[hsl(var(--ember))]/35 via-gold/20 to-[hsl(var(--ember))]/15"
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
      ? "bg-gradient-to-r from-[hsl(var(--ember))] to-gold"
      : tier === "elite"
      ? "bg-gradient-to-r from-gold-dark to-gold"
      : tier === "high_performer"
      ? "bg-[hsl(var(--purple))]"
      : tier === "performer"
      ? "bg-[hsl(210_90%_56%)]"
      : tier === "operator"
      ? "bg-[hsl(var(--teal))]"
      : "bg-muted-foreground/40";

  // Full identity strip (avatar, tier, progress, Premium/Legend) only on Home
  // and the Leaderboard. Every other tab gets just the brand strip.
  const showIdentity =
    location.pathname === "/" || location.pathname === "/leaderboard";

  return (
    <header className="sticky top-0 z-40 safe-top">
      {/* Header now matches the body colour exactly — same near-black canvas,
          just a subtle backdrop blur so scrolled content reads cleanly under
          it. No glass tint, no tier colour wash (those made the top bar look
          like a different shade than the page). */}
      <div className="relative bg-[hsl(var(--background)/0.97)] hairline-bottom border-x-0 border-t-0 border-b-0 rounded-none">
        {/* Tier colour wash REMOVED — kept transparent so the bar is one tone
            with the body (was a teal/amber tint that read as "different
            colour" at the top of the screen). */}

        {/* Top hairline shimmer — flame-tinted for Apex */}
        <div className={cn(
          "pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          isApex ? "via-[hsl(var(--ember))]/70" : "via-gold/55",
        )} />

        {/* Bottom rim — only when user is hot (streak ≥ 7). Pulses with tier accent. */}
        {streak >= 7 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${
                isApex
                  ? "hsl(var(--ember) / 0.85)"
                  : tier === "legend"
                  ? "hsl(280 70% 60% / 0.8)"
                  : tier === "elite"
                  ? "hsl(var(--gold) / 0.8)"
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
              { left: "30%", delay: "0s",   color: isApex ? "hsl(var(--ember))" : "hsl(var(--gold-light))" },
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
          <BrandLogo size={28} alt="" className="rounded-md shadow-[0_2px_8px_hsl(var(--gold)/0.5)]" />
          <span className="font-display font-black tracking-[0.22em] uppercase text-gradient-gold leading-none text-lg">
            Whealth Factory
          </span>
        </button>


        {/* Single status row: avatar + identity + tier progress + pill.
            Shown only on Home + Leaderboard; other tabs keep just the brand. */}
        {showIdentity && (
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
            {/* Row 1: name + streak — username glows gold at Elite, animated
                molten gold at Apex (tier styling via TierUsername). */}
            <div className="flex items-center gap-2">
              <TierUsername
                as="p"
                username={profile.username}
                tier={tier}
                className="text-base font-black truncate leading-none"
              />
              {streak > 0 && (
                <StreakFlameInline streak={streak} suffix="" className="leading-none text-xs" />
              )}
              {((profile as any).streak_shields ?? 0) > 0 && (
                <span
                  className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-teal leading-none"
                  title={`${(profile as any).streak_shields} streak shield${(profile as any).streak_shields === 1 ? "" : "s"} — a missed day costs a shield, not your streak`}
                >
                  🛡️{(profile as any).streak_shields}
                </span>
              )}
            </div>

            {/* Row 2: tier label + next-tier CTA */}
            <div className="flex items-center justify-between gap-2 mt-1.5">
              {/* Label may truncate (never overflow under the chip); the
                  percentile is the first thing to give way. */}
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <span
                  className={cn(
                    "truncate min-w-0 text-[10px] uppercase tracking-[0.22em] font-black leading-none",
                    config.textClass,
                  )}
                >
                  {formatTier(tier, division)}
                </span>
                <span className="hidden min-[400px]:inline truncate shrink-[2] text-[10px] text-muted-foreground/70 leading-none">
                  · {topShareLabel(tier, rankData)}
                </span>
              </div>
              {tier !== "legend" && (() => {
                // Status is EARNED — never bought. This chip shows HOW TO EARN the
                // next tier (its requirements), it must not route to the paywall.
                const nextIdx = TIER_ORDER.indexOf(tier as any) + 1;
                const nextKey = nextIdx > 0 && nextIdx < TIER_ORDER.length ? TIER_ORDER[nextIdx] : "legend";
                const target = `/profile?tier=${nextKey}`;
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
                      "shrink-0 inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-black leading-none whitespace-nowrap px-2 py-1 rounded-full border transition-all active:scale-95 cursor-pointer",
                      isLegendTarget
                        ? "text-gold border-gold/55 bg-gradient-to-r from-[hsl(280_70%_55%)]/15 via-gold/12 to-[hsl(350_80%_55%)]/15 hover:border-gold shadow-[0_0_8px_hsl(var(--gold)/0.30)]"
                        : "text-[hsl(18_95%_62%)] border-[hsl(var(--ember))]/50 bg-[hsl(var(--ember))]/10 hover:border-[hsl(var(--ember))] shadow-[0_0_6px_hsl(var(--ember)/0.20)]",
                    )}
                    aria-label={`How to reach ${label}`}
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
            <div className="surface-metal shrink-0 relative flex items-center gap-1 px-2.5 py-1 rounded-full border border-[hsl(var(--ember))]/55 animate-breathe-soft">
              <Zap
                size={11}
                className="relative z-10 text-primary-foreground status-flame-flicker"
                strokeWidth={3}
                fill="currentColor"
              />
              <span className="relative z-10 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                Apex
              </span>
            </div>
          ) : isElite ? (
            <div className="surface-metal shrink-0 relative flex items-center gap-1 px-2.5 py-1 rounded-full border border-gold/55 animate-breathe-soft">
              <Crown size={11} className="relative z-10 text-primary-foreground status-flame-flicker" />
              {/* Membership indicator — NOT the earned "Elite" rank tier (that's
                  shown in the tier row above). Buying a subscription must never
                  read as having earned the Elite status. */}
              <span className="relative z-10 text-[10px] font-bold text-primary-foreground uppercase tracking-wider">
                Premium
              </span>
            </div>
          ) : isInTrial ? (
            <button
              onClick={() => navigate("/paywall")}
              aria-label="Free trial — full access. Tap to see membership."
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors active:scale-[0.96]",
                trialUrgent
                  ? "bg-destructive/12 border-destructive/45 text-destructive"
                  : "bg-gold/10 border-gold/35 text-gold",
              )}
            >
              {trialUrgent ? <Clock size={11} /> : <Crown size={11} />}
              {/* Narrow screens keep just crown + days — the long label was
                  squeezing the tier row into "RE…" next to the next-tier chip. */}
              <span className="hidden min-[400px]:inline text-[10px] font-bold uppercase tracking-wider">
                {trialUrgent ? `Ends in ${trialLabel}` : `Full access · ${trialLabel}`}
              </span>
              <span className="min-[400px]:hidden text-[10px] font-bold uppercase tracking-wider">
                {trialLabel}
              </span>
            </button>
          ) : null}
        </div>
        )}
      </div>
    </header>
  );
};

export default StatusHeader;
