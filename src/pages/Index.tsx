import { ChevronRight, Award } from "lucide-react";
import BadgeCard from "@/components/BadgeCard";
import TierRiskBanner from "@/components/TierRiskBanner";
import InviteCTA from "@/components/InviteCTA";
import CommandDeck from "@/components/home/CommandDeck";
import RankProgressHub from "@/components/home/RankProgressHub";
import CoachStrip from "@/components/home/CoachStrip";
import Reveal from "@/components/home/Reveal";
import EmptyState from "@/components/ui/empty-state";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTierConfig } from "@/lib/status-tiers";
import { useTierRisk } from "@/hooks/use-tier-risk";
import { useMyRank } from "@/hooks/use-my-rank";
import { useDailyPulse } from "@/hooks/use-daily-pulse";

const Index = () => {
  const navigate = useNavigate();
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
    <div className="h-full pb-6 px-4 pt-5 safe-top relative overflow-y-auto overflow-x-hidden">
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

      {/* RANK + PROGRESS HUB — identity strip + Pressure/Rivals/Level/Elite/Quests */}
      <Reveal className="mb-4 relative z-10" delay={80}>
        <RankProgressHub
          username={profile.username}
          tier={tier}
          userId={profile.user_id}
          rank={rankData?.rank ?? null}
          totalUsers={rankData?.totalUsers ?? 0}
          percentile={rankData?.percentile ?? 0}
          hasRank={rankData?.hasRank ?? false}
          rankScore={Number((profile as any).rank_score) || 0}
          daysAtTier={
            (profile as any).rank_score_updated_at
              ? Math.max(
                  1,
                  Math.floor(
                    (Date.now() -
                      new Date((profile as any).rank_score_updated_at).getTime()) /
                      (1000 * 60 * 60 * 24),
                  ),
                )
              : undefined
          }
          rankDelta={pulse.loading ? 0 : pulse.rankDelta}
          level={profile.level}
          xp={profile.xp}
          xpToNext={xpToNext}
          canCheckin={canCheckin}
        />
      </Reveal>

      {/* COACH STRIP */}
      <Reveal className="mb-5 relative z-10" delay={160}>
        <CoachStrip latestNudge={latestNudge ?? null} latestBriefing={latestBriefing ?? null} />
      </Reveal>

      {/* GROWTH ROW — Invite + Recent Badges */}
      <Reveal className="mb-4" delay={240}>
        <InviteCTA referralCount={profile.referral_count || 0} />
      </Reveal>

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
