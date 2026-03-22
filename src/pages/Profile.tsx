import { Flame, Zap, Award, Shield, Settings, Share2, Crown, LogOut } from "lucide-react";
import StatCard from "@/components/StatCard";
import BadgeCard from "@/components/BadgeCard";
import BadgeShowcase from "@/components/BadgeShowcase";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";

const Profile = () => {
  const { profile, signOut } = useAuth();
  const [previewBadge, setPreviewBadge] = useState<any>(null);

  const { data: allBadges } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("*").order("rarity");
      return data || [];
    },
  });

  const { data: earnedBadgeIds } = useQuery({
    queryKey: ["earned-badges", profile?.user_id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", profile.user_id);
      return data?.map((b) => b.badge_id) || [];
    },
    enabled: !!profile,
  });

  const { data: battleStats } = useQuery({
    queryKey: ["battle-stats", profile?.user_id],
    queryFn: async () => {
      if (!profile) return { won: 0 };
      const { count } = await supabase
        .from("battles")
        .select("*", { count: "exact", head: true })
        .eq("winner_id", profile.user_id);
      return { won: count || 0 };
    },
    enabled: !!profile,
  });

  const earnedBadges = (allBadges || []).filter((b) => earnedBadgeIds?.includes(b.id));

  if (!profile) return null;

  const tierLabel = profile.status_tier === "elite" ? "Elite" :
    profile.status_tier === "high_performer" ? "High Performer" :
    profile.status_tier === "rising" ? "Rising" : "Normal";

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <BadgeUnlockModal badge={previewBadge} onClose={() => setPreviewBadge(null)} />

      {/* Profile Header */}
      <div className="animate-reveal text-center mb-6">
        <div className="relative inline-block mb-3">
          <div className="h-20 w-20 rounded-full gradient-gold flex items-center justify-center glow-gold text-3xl font-black font-display text-primary-foreground">
            {profile.username?.charAt(0)?.toUpperCase()}
          </div>
          <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-card border-2 border-gold flex items-center justify-center">
            <Crown size={14} className="text-gold" />
          </div>
        </div>
        <h1 className="font-display text-xl font-bold tracking-tight">@{profile.username}</h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-xs font-bold text-gold bg-gold/10 px-2.5 py-0.5 rounded-full border border-gold/20">
            {tierLabel}
          </span>
          <span className="text-xs text-muted-foreground">• Level {profile.level}</span>
        </div>

        {/* Badge Showcase — top earned badges */}
        {earnedBadges && earnedBadges.length > 0 && (
          <div className="mt-4">
            <BadgeShowcase
              badges={earnedBadges}
              onBadgeClick={(b) => setPreviewBadge(b)}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6 animate-reveal animate-reveal-delay-1">
        <Button variant="gold-outline" size="sm" className="flex-1">
          <Share2 size={14} />
          Share Profile
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={signOut}>
          <LogOut size={14} />
          Sign Out
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-reveal animate-reveal-delay-2">
        <StatCard icon={Zap} label="Total XP" value={profile.xp.toLocaleString()} variant="gold" />
        <StatCard icon={Flame} label="Streak" value={`${profile.streak}d`} variant="streak" />
        <StatCard icon={Award} label="Battles Won" value={battleStats?.won || 0} />
        <StatCard icon={Shield} label="Badges" value={earnedBadgeIds?.length || 0} />
      </div>

      {/* Badge Vault */}
      <div className="animate-reveal animate-reveal-delay-3">
        <h2 className="font-display font-bold text-sm mb-3 tracking-tight">Badge Vault</h2>
        <div className="grid grid-cols-3 gap-3">
          {allBadges?.map((badge) => {
            const earned = earnedBadgeIds?.includes(badge.id) || false;
            return (
              <div key={badge.id} onClick={() => earned && setPreviewBadge(badge)} className={earned ? "cursor-pointer" : ""}>
                <BadgeCard
                  name={badge.name}
                  icon={badge.icon}
                  rarity={badge.rarity}
                  earned={earned}
                  description={badge.description || undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Elite CTA */}
      {!profile.is_elite && (
        <div className="mt-8 rounded-xl border border-gold/20 bg-card p-5 text-center animate-reveal animate-reveal-delay-4">
          <h3 className="font-display font-bold text-sm mb-1">Unlock Elite Status</h3>
          <p className="text-xs text-muted-foreground mb-3">Full leaderboard, battles, elite feed, XP multiplier</p>
          <Button variant="gold" size="lg" className="w-full">
            Go Elite — €49/mo
          </Button>
        </div>
      )}
    </div>
  );
};

export default Profile;
