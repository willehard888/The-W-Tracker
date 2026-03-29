import AppLogoHeader from "@/components/AppLogoHeader";
import { useMemo } from "react";
import { Flame, ChevronRight, Crown, Shield, Sparkles } from "lucide-react";
import LevelCard from "@/components/LevelCard";
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

  const dailyQuote = useMemo(() => {
    const today = new Date().toDateString();
    let hash = 0;
    for (let i = 0; i < today.length; i++) hash = ((hash << 5) - hash) + today.charCodeAt(i);
    return motivationalQuotes[Math.abs(hash) % motivationalQuotes.length];
  }, []);

  if (!profile) return null;

  const xpToNext = profile.level * 500;
  const xpPercent = Math.min(100, Math.round((profile.xp / xpToNext) * 100));

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

  const tierLabel =
    profile.status_tier === "elite"
      ? "Elite"
      : profile.status_tier === "high_performer"
      ? "High Performer"
      : profile.status_tier === "rising"
      ? "Rising"
      : "Normal";

  return (
    <div className="h-full pb-4 px-4 pt-6 safe-top relative overflow-y-auto overflow-x-hidden">
      {/* Dramatic ambient top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[420px] pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse at center top, hsl(42 78% 54% / 0.16) 0%, hsl(42 78% 54% / 0.05) 40%, transparent 75%)",
        }}
      />
      <div
        className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] pointer-events-none z-0"
        style={{
          background: "radial-gradient(ellipse at center, hsl(270 60% 58% / 0.07) 0%, transparent 65%)",
        }}
      />
      {/* Moving scanline accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none z-10 opacity-20"
        style={{
          background:
            "linear-gradient(90deg, transparent 10%, hsl(42 78% 54% / 0.6) 50%, transparent 90%)",
          animation: "shimmer-slide 6s ease-in-out infinite",
        }}
      />

      {/* Header */}
      <div className="animate-reveal mb-6 relative z-10">
        <AppLogoHeader />
        <p className="text-base text-muted-foreground font-medium text-center -mt-3 mb-2">{dailyQuote}</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="font-display text-3xl font-bold tracking-tight">@{profile.username}</h1>

          {profile.status_tier === "elite" ? (
            <div className="relative group">
              <div
                className="absolute -inset-1 rounded-full opacity-40 blur-md animate-pulse"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(270 60% 58%), hsl(42 90% 55%), hsl(270 60% 58%))",
                }}
              />
              <div
                className="relative flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[hsl(var(--purple))]/50 shadow-[0_0_16px_hsl(var(--purple)/0.2),inset_0_1px_0_hsl(var(--purple-light)/0.2)]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(270 60% 58% / 0.12), hsl(42 78% 54% / 0.08))",
                }}
              >
                <Crown
                  size={14}
                  className="text-gold/70 drop-shadow-[0_0_4px_hsl(var(--purple)/0.4)]"
                />
                <span className="text-xs font-black text-gold/80 tracking-wider uppercase drop-shadow-[0_0_4px_hsl(var(--purple)/0.3)]">
                  Elite
                </span>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full border",
                profile.status_tier === "high_performer"
                  ? "border-purple-500/30 bg-purple-500/5 text-purple-400"
                  : profile.status_tier === "rising"
                  ? "border-sky-500/30 bg-sky-500/5 text-sky-400"
                  : "border-border bg-secondary text-muted-foreground"
              )}
            >
              <Shield size={12} />
              <span className="text-xs font-bold">{tierLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* XP Progress — glassmorphism card */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-2xl glass-card-gold p-5 mb-6 relative overflow-hidden gradient-border-animated shimmer-overlay">
        {/* Ambient gold glow */}
        <div
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, hsl(42 78% 54% / 0.2) 0%, hsl(42 78% 54% / 0.06) 50%, transparent 75%)",
          }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, hsl(270 60% 58% / 0.12) 0%, hsl(270 60% 58% / 0.04) 50%, transparent 75%)",
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
              <div className="flex items-center gap-1">
                <XpCounter
                  value={profile.xp}
                  className="font-display font-black text-gold text-xl tabular-nums glow-gold-text"
                />
              </div>
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
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, hsl(42 85% 70% / 0.5), transparent)",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-muted-foreground text-sm">
              <span className="text-gold font-bold">
                {Math.max(0, xpToNext - profile.xp).toLocaleString()}
              </span>{" "}
              XP to next level
            </p>
            <p className="font-bold text-gold/60 tabular-nums text-sm">{xpPercent}%</p>
          </div>
        </div>
      </div>

      {/* Stats — glassmorphism */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-reveal animate-reveal-delay-2">
        <StreakDisplay streak={profile.streak} longestStreak={profile.longest_streak} />
        <LevelCard level={profile.level} />
      </div>

      {/* Daily Quests Preview */}
      {canCheckin && (
        <div className="animate-reveal animate-reveal-delay-3 mb-6">
          <div className="rounded-xl glass-card border-purple-500/25 p-4 text-center relative overflow-hidden pulse-dot">
            {/* Animated background shimmer */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(135deg, hsl(270 60% 58% / 0.08), transparent 60%)",
              }}
            />
            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Sparkles size={16} className="text-[hsl(var(--purple))] float-subtle" />
                <p className="text-base font-bold text-purple-300">Daily Quests Available</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Complete bonus objectives during check-in for extra XP
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Check-in CTA — breathing glow */}
      <div className="animate-reveal animate-reveal-delay-3 mb-6">
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
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-1 text-xs text-gold font-medium hover:underline"
          >
            View All <ChevronRight size={14} />
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
          <div className="rounded-xl glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Complete check-ins to earn badges</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
