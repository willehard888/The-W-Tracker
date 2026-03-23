import { Flame, TrendingUp, Award, ChevronRight, Crown, Shield } from "lucide-react";
import StatCard from "@/components/StatCard";
import StreakDisplay from "@/components/StreakDisplay";
import BadgeCard from "@/components/BadgeCard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import XpCounter from "@/components/XpCounter";
import { cn } from "@/lib/utils";

const motivationalQuotes = [
  "Grind never stops 🔥",
  "Discipline beats talent",
  "Champions train, losers complain",
  "Hard work pays off",
  "Level up or get left behind",
  "Stay hungry, stay humble",
  "Prove them wrong 🏆",
  "Consistency is king",
  "No excuses, only results",
  "Outwork everyone 💪",
  "Built different",
  "One day or day one — you decide",
  "The grind includes rest days too",
  "Earn your status",
  "Legends are made, not born",
];

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

  const dailyQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];

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
        <p className="text-sm text-muted-foreground font-medium">{dailyQuote}</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">@{profile.username}</h1>

          {/* Tier Badge — Elite gets premium treatment */}
          {profile.status_tier === "elite" ? (
            <div className="relative group">
              {/* Animated glow ring */}
              <div className="absolute -inset-1 rounded-full opacity-40 blur-md animate-pulse"
                style={{ background: "linear-gradient(135deg, hsl(270 60% 58%), hsl(42 90% 55%), hsl(270 60% 58%))" }}
              />
              <div className="relative flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[hsl(var(--purple))]/50 shadow-[0_0_16px_hsl(var(--purple)/0.2),inset_0_1px_0_hsl(var(--purple-light)/0.2)]"
                style={{ background: "linear-gradient(135deg, hsl(270 60% 58% / 0.12), hsl(42 78% 54% / 0.08))" }}
              >
                <Crown size={14} className="text-gold/70 drop-shadow-[0_0_4px_hsl(var(--purple)/0.4)]" />
                <span className="text-xs font-black text-gold/80 tracking-wider uppercase drop-shadow-[0_0_4px_hsl(var(--purple)/0.3)]">
                  Elite
                </span>
              </div>
            </div>
          ) : (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full border",
              profile.status_tier === "high_performer"
                ? "border-purple-500/30 bg-purple-500/5 text-purple-400"
                : profile.status_tier === "rising"
                  ? "border-sky-500/30 bg-sky-500/5 text-sky-400"
                  : "border-border bg-secondary text-muted-foreground"
            )}>
              <Shield size={12} />
              <span className="text-xs font-bold">{tierLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* XP Progress */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-2xl border border-gold/20 bg-card p-5 mb-6 relative overflow-hidden card-depth-lg">
        {/* Ambient gold glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none" style={{
          background: "radial-gradient(circle, hsl(42 78% 54% / 0.12) 0%, transparent 70%)",
        }} />
        {/* Ambient purple glow */}
        <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full pointer-events-none" style={{
          background: "radial-gradient(circle, hsl(270 60% 58% / 0.08) 0%, transparent 70%)",
        }} />
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-gold flex items-center justify-center">
                <span className="text-xs font-black text-primary-foreground">{profile.level}</span>
              </div>
              <div>
                <p className="font-display font-black text-sm tracking-tight">Level {profile.level}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Rank Progress</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1">
                <XpCounter value={profile.xp} className="font-display font-black text-gold text-lg tabular-nums glow-gold-text" />
              </div>
              <p className="text-[10px] text-muted-foreground">/ {xpToNext.toLocaleString()} XP</p>
            </div>
          </div>

          <div className="mt-3 h-4 rounded-full bg-secondary/80 overflow-hidden border border-border/50 surface-inset">
            <div
              className="h-full rounded-full gradient-gold transition-all duration-1000 ease-out relative"
              style={{ width: `${Math.max(4, xpPercent)}%` }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div className="absolute inset-0 -translate-x-full animate-[shine_3s_ease-in-out_infinite]"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(42 85% 70% / 0.5), transparent)" }} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              <span className="text-gold font-bold">{Math.max(0, xpToNext - profile.xp).toLocaleString()}</span> XP to next level
            </p>
            <p className="text-[10px] font-bold text-gold/60 tabular-nums">{xpPercent}%</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-reveal animate-reveal-delay-2">
        <StatCard icon={TrendingUp} label="Status" value={tierLabel} variant={profile.status_tier === "elite" ? "elite" : "purple"} />
        <StreakDisplay streak={profile.streak} longestStreak={profile.longest_streak} />
        <StatCard icon={TrendingUp} label="Status" value={tierLabel} variant={profile.status_tier === "elite" ? "elite" : "purple"} />
        <StatCard icon={Award} label="Level" value={profile.level} variant="teal" />
      </div>

      {/* Daily Quests Preview */}
      {canCheckin && (
        <div className="animate-reveal animate-reveal-delay-3 mb-6">
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-center">
            <p className="text-sm font-bold text-purple-300 mb-1">🎯 Daily Quests Available</p>
            <p className="text-xs text-muted-foreground">Complete bonus objectives during check-in for extra XP</p>
          </div>
        </div>
      )}

      {/* Check-in CTA — moved after quests */}
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
