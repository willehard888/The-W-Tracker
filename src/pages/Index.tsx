import { Flame, ChevronRight, Crown, Sparkles, FileText } from "lucide-react";
import LevelCard from "@/components/LevelCard";
import StreakDisplay from "@/components/StreakDisplay";
import BadgeCard from "@/components/BadgeCard";
import StatusBadge from "@/components/StatusBadge";
import RankPressureCard from "@/components/RankPressureCard";
import CoachNudgeCard from "@/components/CoachNudgeCard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import XpCounter from "@/components/XpCounter";
import { cn } from "@/lib/utils";
import { getTierConfig } from "@/lib/status-tiers";
import RoadToElite from "@/components/RoadToElite";


const Index = () => {
  const navigate = useNavigate();
  const { profile, isElite } = useAuth();

  const { data: latestNudge } = useQuery({
    queryKey: ["latest-coach-nudge", profile?.user_id],
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

  const { data: rankData } = useQuery({
    queryKey: ["my-rank-home", profile?.user_id],
    queryFn: async () => {
      if (!profile) return null;
      const [{ count: ahead }, { count: total }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).gt("rank_score" as any, (profile as any).rank_score || 0),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gt("xp", 0),
      ]);
      const rank = (ahead ?? 0) + 1;
      const totalUsers = total ?? 1;
      const percentile = Math.max(1, Math.round(((totalUsers - rank) / totalUsers) * 100));
      return { rank, totalUsers, percentile };
    },
    enabled: !!profile,
  });
      {/* Road to Elite — compact teaser (hidden once earned) */}
      <div className="animate-reveal animate-reveal-delay-1 mb-4 relative z-10">
        <RoadToElite compact />
      </div>


  if (!profile) return null;

  const xpToNext = profile.level * 500;
  const xpPercent = Math.min(100, Math.round((profile.xp / xpToNext) * 100));
  const tier = profile.status_tier || 'recruit';
  const tierConfig = getTierConfig(tier);

  const canCheckin =
    !lastCheckin || Date.now() - new Date(lastCheckin.checked_in_at).getTime() > 24 * 60 * 60 * 1000;

  const getTimeUntilCheckin = () => {
    if (!lastCheckin || canCheckin) return null;
    const nextTime = new Date(lastCheckin.checked_in_at).getTime() + 24 * 60 * 60 * 1000;
    const diff = nextTime - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="h-full pb-4 px-4 pt-6 safe-top relative overflow-y-auto overflow-x-hidden">
      {/* Dramatic ambient top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[420px] pointer-events-none z-0"
        style={{
          background: tier === 'legend'
            ? "radial-gradient(ellipse at center top, hsl(280 70% 60% / 0.18) 0%, hsl(42 78% 54% / 0.08) 40%, transparent 75%)"
            : tier === 'apex'
            ? "radial-gradient(ellipse at center top, hsl(18 95% 58% / 0.16) 0%, hsl(42 78% 54% / 0.06) 40%, transparent 75%)"
            : "radial-gradient(ellipse at center top, hsl(42 78% 54% / 0.16) 0%, hsl(42 78% 54% / 0.05) 40%, transparent 75%)",
        }}
      />
      <div
        className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] pointer-events-none z-0"
        style={{
          background: "radial-gradient(ellipse at center, hsl(270 60% 58% / 0.07) 0%, transparent 65%)",
        }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none z-10 opacity-20"
        style={{
          background: "linear-gradient(90deg, transparent 10%, hsl(42 78% 54% / 0.6) 50%, transparent 90%)",
          animation: "shimmer-slide 6s ease-in-out infinite",
        }}
      />

      {/* Rank Pressure Card */}
      {rankData && (
        <div className="animate-reveal animate-reveal-delay-1 mb-4 relative z-10">
          <RankPressureCard
            tier={tier}
            rank={rankData.rank}
            totalUsers={rankData.totalUsers}
            percentile={rankData.percentile}
            rankScore={(profile as any).rank_score}
          />
        </div>
      )}

      {/* Coach Nudge (Elite, unseen) */}
      {latestNudge && (
        <div className="animate-reveal animate-reveal-delay-1 mb-4 relative z-10">
          <CoachNudgeCard
            nudgeId={latestNudge.id}
            headline={latestNudge.headline}
            content={latestNudge.content}
          />
        </div>
      )}

      {/* Latest Weekly Briefing (Elite, < 7 days old) */}
      {latestBriefing && (
        <button
          onClick={() => navigate(`/briefing/${latestBriefing.id}`)}
          className="w-full animate-reveal animate-reveal-delay-1 mb-4 relative z-10 rounded-2xl glass-card-gold p-4 text-left active:scale-[0.99] transition-transform border border-gold/25"
        >
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg gradient-gold flex items-center justify-center shrink-0">
              <FileText size={16} className="text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-gold/80 font-bold mb-0.5">
                {latestBriefing.viewed_at ? "Weekly Briefing" : "New Weekly Briefing"}
              </p>
              <p className="font-bold text-sm leading-tight line-clamp-2">
                {latestBriefing.headline}
              </p>
            </div>
            <ChevronRight size={18} className="text-gold/60 shrink-0 mt-1" />
          </div>
        </button>
      )}

      <div className="animate-reveal animate-reveal-delay-1 rounded-2xl glass-card-gold p-5 mb-4 relative overflow-hidden gradient-border-animated shimmer-overlay">
        <div
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, hsl(42 78% 54% / 0.2) 0%, hsl(42 78% 54% / 0.06) 50%, transparent 75%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-gold flex items-center justify-center float-subtle">
                <span className="font-black text-primary-foreground text-xl">{profile.level}</span>
              </div>
              <div>
                <p className="font-display font-black tracking-tight text-lg">Level {profile.level}</p>
                <p className="text-muted-foreground uppercase tracking-widest text-sm">Rank Progress</p>
              </div>
            </div>
            <div className="text-right">
              <XpCounter value={profile.xp} className="font-display font-black text-gold text-xl tabular-nums glow-gold-text" />
              <p className="text-muted-foreground text-sm">/ {xpToNext.toLocaleString()} XP</p>
            </div>
          </div>

          <div className="mt-3 h-4 rounded-full bg-secondary/80 overflow-hidden border border-border/50 surface-inset">
            <div
              className="h-full rounded-full gradient-gold transition-all duration-1000 ease-out relative"
              style={{ width: `${Math.max(4, xpPercent)}%` }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div
                  className="absolute inset-0 -translate-x-full animate-[shine_3s_ease-in-out_infinite]"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(42 85% 70% / 0.5), transparent)" }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-muted-foreground text-sm">
              <span className="text-gold font-bold">{Math.max(0, xpToNext - profile.xp).toLocaleString()}</span> XP to next level
            </p>
            <p className="font-bold text-gold/60 tabular-nums text-sm">{xpPercent}%</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 animate-reveal animate-reveal-delay-2">
        <StreakDisplay streak={profile.streak} longestStreak={profile.longest_streak} lastCheckinAt={lastCheckin?.checked_in_at} />
      </div>

      {/* Streak Pressure Warning */}
      {profile.streak > 0 && canCheckin && (
        <div className="animate-reveal animate-reveal-delay-2 mb-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-center">
            <p className="text-xs font-bold text-destructive">
              ⚠️ Don't break your {profile.streak}-day streak. Check in now.
            </p>
            <p className="text-[10px] text-destructive/60 mt-0.5">Most fail before day {Math.ceil((profile.streak + 1) / 7) * 7}</p>
          </div>
        </div>
      )}

      {/* Daily Quests Preview */}
      {canCheckin && (
        <div className="animate-reveal animate-reveal-delay-3 mb-4">
          <div className="rounded-xl glass-card border-purple-500/25 p-4 text-center relative overflow-hidden pulse-dot">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, hsl(270 60% 58% / 0.08), transparent 60%)" }} />
            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Sparkles size={16} className="text-[hsl(var(--purple))] float-subtle" />
                <p className="text-base font-bold text-purple-300">Daily Quests Available</p>
              </div>
              <p className="text-sm text-muted-foreground">Complete bonus objectives for extra XP</p>
            </div>
          </div>
        </div>
      )}

      {/* Check-in CTA */}
      <div className="animate-reveal animate-reveal-delay-3 mb-4">
        <Button
          variant="gold"
          size="xl"
          className={cn("w-full", canCheckin && "breathing-glow")}
          onClick={() => navigate("/checkin")}
          disabled={!canCheckin}
        >
          <Flame size={20} />
          {canCheckin ? "Log Today's Execution" : "Already Logged Today"}
        </Button>
        {!canCheckin && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            Next check-in in {getTimeUntilCheckin()}
          </p>
        )}
      </div>

      {/* Recent Badges */}
      <div className="animate-reveal animate-reveal-delay-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-base tracking-tight">Recent Badges</h2>
          <button onClick={() => navigate("/profile")} className="flex items-center gap-1 text-xs text-gold font-medium hover:underline">
            View All <ChevronRight size={14} />
          </button>
        </div>
        {userBadges && userBadges.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {userBadges.map((ub: any) => (
              <BadgeCard key={ub.id} name={ub.badges.name} icon={ub.badges.icon} rarity={ub.badges.rarity} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Complete check-ins to earn badges</p>
          </div>
        )}
      </div>

      {/* Tier status message */}
      <div className="animate-reveal animate-reveal-delay-4 mt-4 mb-2 text-center">
        <p className="text-[10px] text-muted-foreground/40 font-semibold tracking-widest uppercase">
          {tierConfig.message}
        </p>
      </div>
    </div>
  );
};

export default Index;
