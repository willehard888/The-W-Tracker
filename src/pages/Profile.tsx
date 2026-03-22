import { Flame, Zap, Award, Shield, Settings, Share2, Crown } from "lucide-react";
import StatCard from "@/components/StatCard";
import BadgeCard from "@/components/BadgeCard";
import { Button } from "@/components/ui/button";

const allBadges = [
  { name: "3-Day Streak", icon: "🔥", rarity: "common" as const },
  { name: "7-Day Streak", icon: "🔥", rarity: "rare" as const },
  { name: "14-Day Streak", icon: "🔥", rarity: "rare" as const },
  { name: "30-Day Streak", icon: "💎", rarity: "epic" as const },
  { name: "Cold Warrior", icon: "🧊", rarity: "epic" as const },
  { name: "Iron Discipline", icon: "⚔️", rarity: "legendary" as const },
  { name: "Proof Poster", icon: "📸", rarity: "rare" as const },
  { name: "Battle Victor", icon: "🏆", rarity: "epic" as const },
  { name: "Top 10%", icon: "📊", rarity: "epic" as const },
  { name: "Top 1%", icon: "👑", rarity: "legendary" as const, earned: false },
  { name: "Founder", icon: "⭐", rarity: "legendary" as const },
  { name: "Spring '26", icon: "🌸", rarity: "rare" as const, earned: false },
];

const Profile = () => {
  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* Profile Header */}
      <div className="animate-reveal text-center mb-6">
        <div className="relative inline-block mb-3">
          <div className="h-20 w-20 rounded-full gradient-gold flex items-center justify-center glow-gold text-3xl font-black font-display text-primary-foreground">
            I
          </div>
          <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-card border-2 border-gold flex items-center justify-center">
            <Crown size={14} className="text-gold" />
          </div>
        </div>
        <h1 className="font-display text-xl font-bold tracking-tight">@ironwill_47</h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-xs font-bold text-gold bg-gold/10 px-2.5 py-0.5 rounded-full border border-gold/20">
            High Performer
          </span>
          <span className="text-xs text-muted-foreground">• Level 12</span>
        </div>

        {/* Showcase badges */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {["⚔️", "🧊", "🏆"].map((icon, i) => (
            <div key={i} className="h-8 w-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-sm">
              {icon}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6 animate-reveal animate-reveal-delay-1">
        <Button variant="gold-outline" size="sm" className="flex-1">
          <Share2 size={14} />
          Share Profile
        </Button>
        <Button variant="secondary" size="sm" className="flex-1">
          <Settings size={14} />
          Settings
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-reveal animate-reveal-delay-2">
        <StatCard icon={Zap} label="Total XP" value="3,847" variant="gold" />
        <StatCard icon={Flame} label="Streak" value="14d" variant="streak" />
        <StatCard icon={Award} label="Battles Won" value="7" />
        <StatCard icon={Shield} label="Badges" value="10" />
      </div>

      {/* Badge Vault */}
      <div className="animate-reveal animate-reveal-delay-3">
        <h2 className="font-display font-bold text-sm mb-3 tracking-tight">Badge Vault</h2>
        <div className="grid grid-cols-3 gap-3">
          {allBadges.map((badge) => (
            <BadgeCard key={badge.name} earned={badge.earned !== false} {...badge} />
          ))}
        </div>
      </div>

      {/* Elite CTA */}
      <div className="mt-8 rounded-xl border border-gold/20 bg-card p-5 text-center animate-reveal animate-reveal-delay-4">
        <h3 className="font-display font-bold text-sm mb-1">Unlock Elite Status</h3>
        <p className="text-xs text-muted-foreground mb-3">Full leaderboard, battles, elite feed, XP multiplier</p>
        <Button variant="gold" size="lg" className="w-full">
          Go Elite — €49/mo
        </Button>
      </div>
    </div>
  );
};

export default Profile;
