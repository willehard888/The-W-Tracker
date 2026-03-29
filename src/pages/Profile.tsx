import AppLogoHeader from "@/components/AppLogoHeader";
import { Flame, Zap, Award, Shield, Share2, Crown, LogOut, Users, Image, GitCompare, Camera, MessageSquare, Heart, Trophy, CreditCard, Medal, Moon } from "lucide-react";
import { isNativePlatform } from "@/lib/platform";
import StatCard from "@/components/StatCard";
import StreakDisplay from "@/components/StreakDisplay";
import BadgeCard from "@/components/BadgeCard";
import BadgeShowcase from "@/components/BadgeShowcase";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";
import StoryShareModal from "@/components/StoryShareModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, subDays, startOfDay } from "date-fns";

const Profile = () => {
  const { profile, signOut, isElite } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewBadge, setPreviewBadge] = useState<any>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [shareModal, setShareModal] = useState<{ open: boolean; variant: "stats" | "streak" | "badge"; badgeData?: any }>({
    open: false,
    variant: "stats",
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${profile.user_id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("proof-photos").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("proof-photos").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", profile.user_id);
      toast.success("Profile photo updated! 📸");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      // Force reload profile
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload photo");
    }
    setUploadingAvatar(false);
    e.target.value = "";
  };

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

  const { data: userPosts } = useQuery({
    queryKey: ["user-posts", profile?.user_id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("feed_posts")
        .select("*")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: kudosReceived } = useQuery({
    queryKey: ["kudos-received", profile?.user_id],
    queryFn: async () => {
      if (!profile) return 0;
      const { count } = await supabase
        .from("kudos")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", profile.user_id);
      return count || 0;
    },
    enabled: !!profile,
  });

  const { data: weeklySleep } = useQuery({
    queryKey: ["weekly-sleep", profile?.user_id],
    queryFn: async () => {
      if (!profile) return null;
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data } = await supabase
        .from("daily_checkins")
        .select("sleep_hours")
        .eq("user_id", profile.user_id)
        .gte("checked_in_at", sevenDaysAgo);
      if (!data || data.length === 0) return null;
      const avg = data.reduce((sum, d) => sum + Number(d.sleep_hours), 0) / data.length;
      const multiplier = avg >= 7 ? 1.0 : avg >= 6 ? 0.85 : avg >= 5 ? 0.7 : 0.5;
      return { avg: Math.round(avg * 10) / 10, days: data.length, multiplier };
    },
    enabled: !!profile,
  });

  const { data: championHistory } = useQuery({
    queryKey: ["champion-history", profile?.user_id],
    queryFn: async () => {
      if (!profile) return { wins: 0, seasons: [] };
      const db = supabase as any;
      const [{ data: champions }, { data: seasons }] = await Promise.all([
        db
          .from("leaderboard_champions")
          .select("season_id, season_points, created_at")
          .eq("user_id", profile.user_id)
          .order("created_at", { ascending: false }),
        db.from("leaderboard_seasons").select("id, name"),
      ]);
      const seasonNames = new Map<string, string>((seasons || []).map((s: any) => [s.id, s.name]));
      return {
        wins: (champions || []).length,
        seasons: (champions || []).map((c: any) => ({
          name: seasonNames.get(c.season_id) || "Season",
          points: c.season_points,
        })),
      };
    },
    enabled: !!profile,
  });

  const earnedBadges = (allBadges || []).filter((b) => earnedBadgeIds?.includes(b.id));

  if (!profile) return null;

  const tierLabel = profile.status_tier === "elite" ? "Elite" :
    profile.status_tier === "high_performer" ? "High Performer" :
    profile.status_tier === "rising" ? "Rising" : "Normal";

  return (
    <div className="min-h-screen pb-4 px-4 pt-6 safe-top">
      <BadgeUnlockModal badge={previewBadge} onClose={() => setPreviewBadge(null)} />
      <StoryShareModal
        open={shareModal.open}
        onClose={() => setShareModal({ ...shareModal, open: false })}
        variant={shareModal.variant}
        badgeData={shareModal.badgeData}
      />

      <AppLogoHeader />

      {/* Profile Header */}
      <div className="animate-reveal text-center mb-6">
        <div className="relative inline-block mb-3">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="h-20 w-20 rounded-full object-cover border-2 border-gold glow-gold"
            />
          ) : (
            <div className="h-20 w-20 rounded-full gradient-gold flex items-center justify-center glow-gold text-3xl font-black font-display text-primary-foreground">
              {profile.username?.charAt(0)?.toUpperCase()}
            </div>
          )}
          {isElite ? (
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-card border-2 border-gold flex items-center justify-center transition-all hover:bg-gold/10 active:scale-95"
            >
              {uploadingAvatar ? (
                <span className="text-[8px] text-gold animate-pulse">...</span>
              ) : (
                <Camera size={12} className="text-gold" />
              )}
            </button>
          ) : (
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-card border-2 border-gold flex items-center justify-center">
              <Crown size={14} className="text-gold" />
            </div>
          )}
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">@{profile.username}</h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-sm font-bold text-gold bg-gold/10 px-2.5 py-0.5 rounded-full border border-gold/20">
            {tierLabel}
          </span>
          <span className="text-sm text-muted-foreground">• Level {profile.level}</span>
        </div>

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
      <div className="flex gap-2 mb-3 animate-reveal animate-reveal-delay-1">
        <Button
          variant="gold-outline"
          size="sm"
          className="flex-1"
          onClick={() => setShareModal({ open: true, variant: "stats" })}
        >
          <Image size={14} />
          Share Stats
        </Button>
        <Button
          variant="gold-outline"
          size="sm"
          className="flex-1"
          onClick={() => setShareModal({ open: true, variant: "streak" })}
        >
          <Flame size={14} />
          Share Streak
        </Button>
      </div>
      <div className="flex gap-2 mb-3 animate-reveal animate-reveal-delay-1">
        <Button variant="gold-outline" size="sm" className="flex-1" onClick={() => navigate("/referrals")}>
          <Users size={14} />
          Invite Friends
        </Button>
        <Button variant="gold-outline" size="sm" className="flex-1" onClick={() => navigate("/badges/compare")}>
          <GitCompare size={14} />
          Compare Badges
        </Button>
      </div>
      {isElite && (
        <div className="flex gap-2 mb-3 animate-reveal animate-reveal-delay-1">
          <Button
            variant="gold-outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              if (isNativePlatform()) {
                // iOS: open App Store subscription management
                window.open("https://apps.apple.com/account/subscriptions", "_blank");
              } else {
                // Web: open Stripe customer portal
                supabase.functions.invoke("customer-portal").then(({ data, error }) => {
                  if (data?.url) window.open(data.url, "_blank");
                  else toast.error("Could not open subscription management");
                });
              }
            }}
          >
            <CreditCard size={14} />
            Manage Subscription
          </Button>
        </div>
      )}
      <div className="flex gap-2 mb-6 animate-reveal animate-reveal-delay-1">
        <Button variant="secondary" size="sm" className="flex-1" onClick={signOut}>
          <LogOut size={14} />
          Sign Out
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-reveal animate-reveal-delay-2">
        <StatCard icon={Zap} label="Total XP" value={profile.xp.toLocaleString()} variant="gold" />
        <StreakDisplay streak={profile.streak} longestStreak={profile.longest_streak} />
        <StatCard icon={Award} label="Battles Won" value={battleStats?.won || 0} variant="rose" />
        <StatCard icon={Shield} label="Badges" value={earnedBadgeIds?.length || 0} variant="purple" />
        <StatCard icon={Trophy} label="Kudos Received" value={kudosReceived || 0} variant="gold" />
      </div>

      {/* Champion History */}
      {championHistory && championHistory.wins > 0 && (
        <div className="mb-6 animate-reveal animate-reveal-delay-2">
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 glow-gold-sm">
            <div className="flex items-center gap-2 mb-3">
              <Medal size={18} className="text-gold" />
              <h2 className="font-display font-bold text-base tracking-tight">Season Champion</h2>
              <span className="ml-auto text-gold font-display font-bold text-lg">{championHistory.wins}x</span>
            </div>
            <div className="space-y-1.5">
              {championHistory.seasons.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-semibold tabular-nums">{s.points.toLocaleString()} XP</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="animate-reveal animate-reveal-delay-3">
        <h2 className="font-display font-bold text-base mb-3 tracking-tight">Badge Vault</h2>
        <div className="grid grid-cols-3 gap-3">
          {allBadges?.map((badge) => {
            const earned = earnedBadgeIds?.includes(badge.id) || false;
            return (
              <div
                key={badge.id}
                onClick={() => {
                  if (earned) {
                    setPreviewBadge(badge);
                  }
                }}
                className={earned ? "cursor-pointer" : ""}
              >
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

      {/* User Posts */}
      {userPosts && userPosts.length > 0 && (
        <div className="mt-6 animate-reveal animate-reveal-delay-4">
          <h2 className="font-display font-bold text-base mb-3 tracking-tight">Posts ({userPosts.length})</h2>
          <div className="space-y-3">
            {userPosts.map((post) => (
              <div key={post.id} className="rounded-xl border border-border bg-card p-4">
                {post.content && <p className="text-base mb-2">{post.content}</p>}
                {post.image_url && (
                  <img src={post.image_url} alt="Post" className="w-full rounded-lg object-cover max-h-48 mb-2" />
                )}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart size={10} /> {post.likes_count}</span>
                  <span className="flex items-center gap-1"><Trophy size={10} className="text-gold" /> {post.kudos_count}</span>
                  <span className="flex items-center gap-1"><MessageSquare size={10} /> {post.comments_count}</span>
                  <span className="ml-auto">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Elite CTA */}
      {!profile.is_elite && (
        <div className="mt-8 rounded-xl border border-gold/20 bg-card p-5 text-center animate-reveal animate-reveal-delay-4">
          <h3 className="font-display font-bold text-base mb-1">Unlock Elite Status</h3>
          <p className="text-sm text-muted-foreground mb-3">Full leaderboard, battles, elite feed, XP multiplier</p>
          <Button variant="gold" size="lg" className="w-full" onClick={() => navigate("/paywall")}>
            Go Elite — 9,99€/kk
          </Button>
        </div>
      )}
    </div>
  );
};

export default Profile;
