import { ChevronRight, Award, Crown, Utensils } from "lucide-react";
import BadgeCard from "@/components/BadgeCard";
import TierRiskBanner from "@/components/TierRiskBanner";
import InviteCTA from "@/components/InviteCTA";
import CommandDeck from "@/components/home/CommandDeck";
import PodCard from "@/components/home/PodCard";
import CoachStrip from "@/components/home/CoachStrip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Reveal from "@/components/home/Reveal";
import EmptyState from "@/components/ui/empty-state";
import MoreSection from "@/components/ui/more-section";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTierConfig } from "@/lib/status-tiers";
import { useTierRisk } from "@/hooks/use-tier-risk";
import { useMyRank } from "@/hooks/use-my-rank";
import { useDailyPulse } from "@/hooks/use-daily-pulse";
// Pull-to-refresh removed temporarily — was intercepting inner taps.

const Index = () => {
  const navigate = useNavigate();

  // Prefetch the most-likely next screens once Home is idle, so the first tap
  // on Feed / Check-in opens instantly (no lazy-chunk wait). Touch devices
  // have no hover, so BottomNav's hover-prefetch never fires — this covers it.
  useEffect(() => {
    const prefetch = () => {
      import("@/pages/EliteFeed");
      import("@/pages/DailyCheckin");
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) {
      const id = ric(prefetch, { timeout: 2500 });
      return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = setTimeout(prefetch, 1500);
    return () => clearTimeout(t);
  }, []);
  const { profile, isElite } = useAuth();

  const { data: latestNudge } = useQuery({
    queryKey: ["latest-coach-nudge", profile?.user_id],
    staleTime: 5 * 60_000,   // nudges don't change every second
    gcTime:    10 * 60_000,
    queryFn: async () => {
      if (!profile || !isElite) return null;
      const { data } = await supabase
        .from("coach_nudges")
        .select("id, headline, content, seen_at, created_at")
        .eq("user_id", profile.user_id)
        .is("seen_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!profile && isElite,
  });

  const { data: latestBriefing } = useQuery({
    queryKey: ["latest-briefing", profile?.user_id],
    staleTime: 60 * 60_000,  // weekly briefings are stable for an hour
    gcTime:    2  * 60 * 60_000,
    queryFn: async () => {
      if (!profile || !isElite) return null;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("weekly_briefings")
        .select("id, headline, viewed_at, generated_at")
        .eq("user_id", profile.user_id)
        .gte("generated_at", sevenDaysAgo)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!profile && isElite,
  });

  const { data: userBadges } = useQuery({
    queryKey: ["user-badges", profile?.user_id],
    staleTime: 10 * 60_000,  // badges change only after check-in
    gcTime:    30 * 60_000,
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("user_badges")
        .select("*, badges(*)")
        .eq("user_id", profile.user_id)
        .order("earned_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: lastCheckin } = useQuery({
    queryKey: ["last-checkin", profile?.user_id],
    staleTime: 5 * 60_000,   // canCheckin window is 24h — 5 min stale is fine
    gcTime:    30 * 60_000,
    queryFn: async () => {
      if (!profile) return null;
      const { data } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", profile.user_id)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!profile,
  });

  const { data: rankData } = useMyRank(profile?.user_id);
  const tierRisk = useTierRisk({
    tier: profile?.status_tier || "recruit",
    rankScore: Number((profile as any)?.rank_score) || 0,
    streak: profile?.streak || 0,
    lastCheckinAt: lastCheckin?.checked_in_at,
  });

  // Live rank delta for HeroHeader pulse line
  const pulse = useDailyPulse(
    profile?.user_id || "",
    rankData?.rank ?? 0,
    Number((profile as any)?.rank_score) || 0,
    rankData?.totalUsers ?? 0,
  );

  // ── Checkin-derived values (hooks must be before any early return) ────────
  const canCheckin = useMemo(
    () =>
      !lastCheckin ||
      Date.now() - new Date(lastCheckin.checked_in_at).getTime() > 24 * 60 * 60 * 1000,
    [lastCheckin],
  );

  const timeUntilCheckin = useMemo(() => {
    if (!lastCheckin || canCheckin) return null;
    const nextTime = new Date(lastCheckin.checked_in_at).getTime() + 24 * 60 * 60 * 1000;
    const diff = nextTime - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  }, [lastCheckin, canCheckin]);

  if (!profile) return null;

  const xpToNext = profile.level * 500;
  const tier = profile.status_tier || "recruit";
  const tierConfig = getTierConfig(tier);
  const isLegend = tier === "legend";
  const isApex = tier === "apex";

  // Tier-reactive page-level aura — softer, wider falloff
  const pageAura = isLegend
    ? "radial-gradient(ellipse 90% 70% at center top, hsl(280 70% 60% / 0.11) 0%, hsl(42 78% 54% / 0.05) 45%, transparent 80%)"
    : isApex
    ? "radial-gradient(ellipse 90% 70% at center top, hsl(18 95% 58% / 0.10) 0%, hsl(42 78% 54% / 0.04) 45%, transparent 80%)"
    : tier === "elite"
    ? "radial-gradient(ellipse 90% 70% at center top, hsl(42 78% 54% / 0.10) 0%, hsl(180 70% 50% / 0.04) 45%, transparent 80%)"
    : "radial-gradient(ellipse 90% 70% at center top, hsl(42 78% 54% / 0.075) 0%, hsl(42 78% 54% / 0.025) 45%, transparent 80%)";

  return (
    <div className="h-full pb-6 px-4 pt-3 relative overflow-y-auto overflow-x-hidden">
      {/* Tier-reactive top aura */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[760px] h-[460px] pointer-events-none z-0"
        style={{ background: pageAura }}
      />

      {/* Ember band — soft fire-in-the-distance warmth tied to user's streak */}
      {profile.streak >= 3 && (
        <div
          aria-hidden
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[180px] pointer-events-none z-0 opacity-70"
          style={{
            background:
              isApex
                ? "radial-gradient(ellipse 70% 100% at 50% 0%, hsl(18 95% 58% / 0.22) 0%, hsl(42 78% 54% / 0.10) 40%, transparent 75%)"
                : isLegend
                ? "radial-gradient(ellipse 70% 100% at 50% 0%, hsl(280 70% 60% / 0.20) 0%, hsl(42 78% 54% / 0.10) 40%, transparent 75%)"
                : "radial-gradient(ellipse 70% 100% at 50% 0%, hsl(18 92% 56% / 0.18) 0%, hsl(42 78% 54% / 0.08) 45%, transparent 80%)",
          }}
        />
      )}

      <div
        className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none z-10 opacity-25"
        style={{
          background:
            "linear-gradient(90deg, transparent 10%, hsl(42 78% 54% / 0.6) 50%, transparent 90%)",
          animation: "shimmer-slide 6s ease-in-out infinite",
        }}
      />

      {/* COMMAND DECK — Streak + Lock Your Day */}
      <div className="animate-reveal mb-4 relative z-10">
        <CommandDeck
          streak={profile.streak}
          longestStreak={profile.longest_streak}
          lastCheckinAt={lastCheckin?.checked_in_at}
          canCheckin={canCheckin}
          timeUntilCheckin={timeUntilCheckin}
          tier={tier}
        />
      </div>

      {/* TIER RISK */}
      {tierRisk.level !== "safe" && (
        <Reveal className="mb-4 relative z-10" delay={0}>
          <TierRiskBanner risk={tierRisk} />
        </Reveal>
      )}

      {/* ACCOUNTABILITY POD — your 3-5 who see your daily check-in. Pinned right
          under the check-in deck so "did my pod show up / did I?" is the second
          thing you see. The core retention loop. */}
      <Reveal className="mb-4 relative z-10" delay={60}>
        <ErrorBoundary fallback={<div className="h-0" aria-hidden />}>
          <PodCard />
        </ErrorBoundary>
      </Reveal>

      {/* THE VAULT — premium content library, raised to the primary slot */}
      <Reveal className="mb-4 relative z-10" delay={80}>
        <button
          type="button"
          onClick={() => navigate("/vault")}
          className="w-full text-left rounded-2xl border border-gold/35 bg-gradient-to-br from-gold/[0.08] via-card/95 to-card p-4 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)] active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 shadow-[0_0_18px_hsl(42_78%_54%/0.4)]">
              <Crown size={18} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85 mb-0.5">
                The Vault · Premium
              </p>
              <p className="text-[13px] font-bold text-foreground leading-tight">
                Recipes, training programs, recovery, sleep &amp; mind tools
              </p>
            </div>
            <ChevronRight size={16} className="text-gold shrink-0" />
          </div>
        </button>
      </Reveal>

      {/* MEAL-PREP RECIPES — structured, scalable, batch-cook recipes */}
      <Reveal className="mb-4 relative z-10" delay={100}>
        <button
          type="button"
          onClick={() => navigate("/recipes")}
          className="w-full text-left rounded-2xl border border-gold/35 bg-gradient-to-br from-gold/[0.08] via-card/95 to-card p-4 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)] active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl overflow-hidden bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 shadow-[0_0_18px_hsl(42_78%_54%/0.4)] relative">
              <Utensils size={18} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} />
              {/* Crop to just the food bowl (top-right of the poster). */}
              <div
                className="absolute inset-0 bg-no-repeat"
                style={{
                  backgroundImage:
                    "url(https://gcwuvijcuzhunkcauzom.supabase.co/storage/v1/object/public/recipe-images/greek-chicken-bowl.png)",
                  backgroundSize: "204%",
                  backgroundPosition: "95% 6%",
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85 mb-0.5">
                Meal-prep recipes
              </p>
              <p className="text-[13px] font-bold text-foreground leading-tight">
                High-protein bowls that scale to a full week of meals
              </p>
            </div>
            <ChevronRight size={16} className="text-gold shrink-0" />
          </div>
        </button>
      </Reveal>

      {/* AI COACH — raised to the primary slot (nudges + briefing → /coach) */}
      <Reveal className="mb-4 relative z-10" delay={120}>
        <ErrorBoundary fallback={<div className="h-0" aria-hidden />}>
          <CoachStrip latestNudge={latestNudge ?? null} latestBriefing={latestBriefing ?? null} />
        </ErrorBoundary>
      </Reveal>

      {/* EARN FREE MEMBERSHIP — referral CTA, surfaced in the primary flow */}
      <Reveal className="mb-4 relative z-10" delay={160}>
        <InviteCTA referralCount={profile.referral_count || 0} />
      </Reveal>

      {/* SECONDARY — collapsed by default so Home opens focused on its one
          job (check in) + rank + a single coach line. Everything below is one
          tap away under "More", per the moderate-declutter design pass. */}
      <MoreSection label="More" className="relative z-10 mt-1 mb-2">
      {/* Recent Badges */}
      <Reveal className="mb-2" delay={320}>
        <div className="flex items-end justify-between mb-3 px-0.5">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/80 mb-1">
              Achievements
            </span>
            <h2 className="font-display font-bold text-base tracking-tight leading-none">
              Recent Badges
            </h2>
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-0.5 text-xs text-gold font-semibold active:opacity-70 transition-opacity"
          >
            View all <ChevronRight size={13} />
          </button>
        </div>
        {userBadges && userBadges.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {userBadges.map((ub: any) => (
              <BadgeCard
                key={ub.id}
                name={ub.badges.name}
                icon={ub.badges.icon}
                rarity={ub.badges.rarity}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Award}
            title="No badges yet"
            description="Lock your day to start earning — first badge unlocks at a 3-day streak."
            action={
              canCheckin ? (
                <button
                  onClick={() => navigate("/checkin")}
                  className="text-xs font-bold text-gold active:opacity-70 transition-opacity inline-flex items-center gap-1"
                >
                  Lock today <ChevronRight size={12} />
                </button>
              ) : null
            }
          />
        )}
      </Reveal>
      </MoreSection>

      {/* Tier message footer — boosted contrast (was muted-foreground/40 → barely visible) */}
      <div className="mt-6 mb-2 text-center">
        <p className="text-[10px] text-muted-foreground/60 font-semibold tracking-[0.22em] uppercase">
          {tierConfig.message}
        </p>
      </div>
    </div>
  );
};

export default Index;
