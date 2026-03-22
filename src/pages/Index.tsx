import { Flame, Zap, TrendingUp, Award, ChevronRight } from "lucide-react";
import StatCard from "@/components/StatCard";
import BadgeCard from "@/components/BadgeCard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const mockUser = {
  username: "ironwill_47",
  level: 12,
  xp: 3847,
  xpToNext: 4500,
  streak: 14,
  rank: "High Performer",
  percentile: 8,
};

const recentBadges = [
  { name: "14-Day Streak", icon: "🔥", rarity: "rare" as const },
  { name: "Cold Warrior", icon: "🧊", rarity: "epic" as const },
  { name: "Iron Discipline", icon: "⚔️", rarity: "legendary" as const },
];

const Index = () => {
  const navigate = useNavigate();
  const xpPercent = Math.round((mockUser.xp / mockUser.xpToNext) * 100);

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* Greeting */}
      <div className="animate-reveal mb-6">
        <p className="text-sm text-muted-foreground font-medium">Welcome back</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">@{mockUser.username}</h1>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold/30 bg-gold/5">
            <Award size={14} className="text-gold" />
            <span className="text-xs font-bold text-gold">{mockUser.rank}</span>
          </div>
        </div>
      </div>

      {/* XP Progress */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Level {mockUser.level}</span>
          <span className="text-xs text-muted-foreground">{mockUser.xp.toLocaleString()} / {mockUser.xpToNext.toLocaleString()} XP</span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full gradient-gold transition-all duration-700 ease-out"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          <span className="text-gold font-semibold">{mockUser.xpToNext - mockUser.xp}</span> XP to Level {mockUser.level + 1}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-reveal animate-reveal-delay-2">
        <StatCard icon={Zap} label="Total XP" value={mockUser.xp.toLocaleString()} variant="gold" />
        <StatCard icon={Flame} label="Streak" value={`${mockUser.streak}d`} sublabel="Personal best: 21d" variant="streak" />
        <StatCard icon={TrendingUp} label="Percentile" value={`Top ${mockUser.percentile}%`} sublabel="Global rank" />
        <StatCard icon={Award} label="Level" value={mockUser.level} sublabel="High Performer" />
      </div>

      {/* Daily Check-in CTA */}
      <div className="animate-reveal animate-reveal-delay-3 mb-6">
        <Button variant="gold" size="xl" className="w-full" onClick={() => navigate("/checkin")}>
          <Flame size={20} />
          Log Today's Execution
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-2">Next check-in available in 8h 23m</p>
      </div>

      {/* Recent Badges */}
      <div className="animate-reveal animate-reveal-delay-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-sm tracking-tight">Recent Badges</h2>
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-1 text-xs text-gold font-medium hover:underline"
          >
            View All <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {recentBadges.map((badge) => (
            <BadgeCard key={badge.name} {...badge} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
