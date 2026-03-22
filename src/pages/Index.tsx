import { Flame, Zap, TrendingUp, Award, ChevronRight } from "lucide-react";
import StatCard from "@/components/StatCard";
import BadgeCard from "@/components/BadgeCard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import XpCounter from "@/components/XpCounter";

const Index = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

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

  if (!profile) return null;

  const xpToNext = profile.level * 500;
  const xpPercent = Math.min(100, Math.round((profile.xp / xpToNext) * 100));

  const canCheckin = !lastCheckin || (Date.now() - new Date(lastCheckin.checked_in_at).getTime() > 24 * 60 * 60 * 1000);

  const getTimeUntilCheckin = () => {
    if (!lastCheckin || canCheckin) return null;
    const nextTime = new Date(lastCheckin.checked_in_at).getTime() + 24 * 60 * 60 * 1000;
    const diff = nextTime - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const tierLabel = profile.status_tier === "elite" ? "Elite" :
    profile.status_tier === "high_performer" ? "High Performer" :
    profile.status_tier === "rising" ? "Rising" : "Normal";

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <div className="animate-reveal mb-6">
        <p className="text-sm text-muted-foreground font-medium">Welcome back</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">@{profile.username}</h1>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold/30 bg-gold/5">
            <Award size={14} className="text-gold" />
            <span className="text-xs font-bold text-gold">{tierLabel}</span>
          </div>
        </div>
      </div>

      {/* XP Progress */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Level {profile.level}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{profile.xp.toLocaleString()} / {xpToNext.toLocaleString()} XP</span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full gradient-gold transition-all duration-700 ease-out" style={{ width: `${xpPercent}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          <span className="text-gold font-semibold">{Math.max(0, xpToNext - profile.xp)}</span> XP to Level {profile.level + 1}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-reveal animate-reveal-delay-2">
        <StatCard icon={Zap} label="Total XP" value={profile.xp.toLocaleString()} variant="gold" />
        <StatCard icon={Flame} label="Streak" value={`${profile.streak}d`} sublabel={`Best: ${profile.longest_streak}d`} variant="streak" />
        <StatCard icon={TrendingUp} label="Status" value={tierLabel} />
        <StatCard icon={Award} label="Level" value={profile.level} />
      </div>

      {/* Check-in CTA */}
      <div className="animate-reveal animate-reveal-delay-3 mb-6">
        <Button
          variant="gold"
          size="xl"
          className="w-full"
          onClick={() => navigate("/checkin")}
          disabled={!canCheckin}
        >
          <Flame size={20} />
          {canCheckin ? "Log Today's Execution" : "Already Logged Today"}
        </Button>
        {!canCheckin && (
          <p className="text-center text-xs text-muted-foreground mt-2">Next check-in in {getTimeUntilCheckin()}</p>
        )}
      </div>

      {/* Recent Badges */}
      <div className="animate-reveal animate-reveal-delay-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-sm tracking-tight">Recent Badges</h2>
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
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Complete check-ins to earn badges</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
