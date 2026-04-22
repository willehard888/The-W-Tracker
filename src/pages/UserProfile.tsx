import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Flame, Zap, Award, Shield, ChevronLeft, Swords, MessageCircle, Snowflake, Dumbbell, Brain, Droplets, Clock, GitCompare, UserPlus, UserCheck, UserX, Heart, MessageSquare, Medal, Crown, TrendingUp, Share2, Trophy } from "lucide-react";
import StatusAvatar from "@/components/StatusAvatar";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/StatCard";
import StreakDisplay from "@/components/StreakDisplay";
import BadgeCard from "@/components/BadgeCard";
import AmbientParticles from "@/components/AmbientParticles";
import HeadToHead from "@/components/HeadToHead";
import ProfileActivityPulse from "@/components/ProfileActivityPulse";
import FeaturedBadgeHero from "@/components/FeaturedBadgeHero";
import ApexBadge from "@/components/ApexBadge";
import StatusNameplate from "@/components/StatusNameplate";
import { getTierConfig, getTierUsernameClass } from "@/lib/status-tiers";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { profile: myProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showBattleModal, setShowBattleModal] = useState(false);
  const [battleType, setBattleType] = useState("xp");
  const [duration, setDuration] = useState(7);
  const [creating, setCreating] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: allBadges } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("*").order("rarity");
      return data || [];
    },
  });

  const { data: earnedBadgeIds } = useQuery({
    queryKey: ["user-earned-badges", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", userId!);
      return data?.map((b) => b.badge_id) || [];
    },
    enabled: !!userId,
  });

  const { data: battleStats } = useQuery({
    queryKey: ["user-battle-stats", userId],
    queryFn: async () => {
      const { count } = await supabase
        .from("battles")
        .select("*", { count: "exact", head: true })
        .eq("winner_id", userId!);
      return { won: count || 0 };
    },
    enabled: !!userId,
  });

  const { data: userPosts } = useQuery({
    queryKey: ["user-posts", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("feed_posts")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: championHistory } = useQuery({
    queryKey: ["champion-history", userId],
    queryFn: async () => {
      const db = supabase as any;
      const [{ data: champions }, { data: seasons }] = await Promise.all([
        db.from("leaderboard_champions").select("season_id, season_points, created_at").eq("user_id", userId!).order("created_at", { ascending: false }),
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
    enabled: !!userId,
  });

  // Featured badge for the hero crown
  const { data: featuredBadge } = useQuery({
    queryKey: ["user-featured-badge", profile?.featured_badge_id],
    enabled: !!profile?.featured_badge_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("badges")
        .select("name, icon, rarity")
        .eq("id", profile!.featured_badge_id!)
        .maybeSingle();
      return data;
    },
  });

  // Global rank — how many users are ahead on rank_score
  const { data: globalRank } = useQuery({
    queryKey: ["user-global-rank", userId, profile?.rank_score],
    enabled: !!userId && !!profile,
    queryFn: async () => {
      const { count: aheadCount } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .gt("rank_score", profile!.rank_score);
      const { count: totalCount } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true });
      return {
        rank: (aheadCount || 0) + 1,
        total: totalCount || 0,
      };
    },
    staleTime: 60_000,
  });
  const { data: friendship } = useQuery({
    queryKey: ["friendship", myProfile?.user_id, userId],
    queryFn: async () => {
      if (!myProfile || !userId || myProfile.user_id === userId) return null;
      const { data } = await supabase
        .from("friendships")
        .select("*")
        .or(`and(requester_id.eq.${myProfile.user_id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${myProfile.user_id})`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!myProfile && !!userId && myProfile.user_id !== userId,
  });

  const handleFriendAction = async (action: "send" | "accept" | "decline" | "cancel" | "remove") => {
    if (!myProfile || !userId) return;
    try {
      if (action === "send") {
        await supabase.from("friendships").insert({ requester_id: myProfile.user_id, addressee_id: userId });
        toast.success("Friend request sent! 🤝");
      } else if (action === "accept" && friendship) {
        await supabase.from("friendships").update({ status: "accepted" as any, updated_at: new Date().toISOString() }).eq("id", friendship.id);
        toast.success("Friend request accepted! 🎉");
      } else if (action === "decline" && friendship) {
        await supabase.from("friendships").update({ status: "declined" as any, updated_at: new Date().toISOString() }).eq("id", friendship.id);
        toast("Request declined");
      } else if ((action === "cancel" || action === "remove") && friendship) {
        await supabase.from("friendships").delete().eq("id", friendship.id);
        toast(action === "cancel" ? "Request cancelled" : "Friend removed");
      }
      queryClient.invalidateQueries({ queryKey: ["friendship"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    } catch {
      toast.error("Something went wrong");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen pb-4 px-4 pt-6 text-center">
        <p className="text-muted-foreground mt-20">User not found</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} /> Go back
        </Button>
      </div>
    );
  }

  const isOwnProfile = myProfile?.user_id === userId;
  const tier = getTierConfig(profile.status_tier || 'recruit');
  const isLegend = profile.status_tier === 'legend';
  const isApex = profile.status_tier === 'apex';
  const isElite = profile.status_tier === 'elite' || profile.is_elite;
  const isHigh = profile.status_tier === 'high_performer';
  const isApexSubscriber = Boolean((profile as any).is_apex_subscriber);
  const isLegendPinned = Boolean((profile as any).legend_pinned);

  // Cinematic tier-based hero gradient
  const heroBg = isLegend
    ? "radial-gradient(120% 80% at 50% 0%, hsl(280 70% 18% / 0.85) 0%, hsl(255 14% 7%) 55%, hsl(350 60% 12% / 0.6) 100%)"
    : isApex
    ? "radial-gradient(120% 80% at 50% 0%, hsl(18 80% 20% / 0.7) 0%, hsl(255 14% 6%) 60%)"
    : isElite
    ? "radial-gradient(120% 80% at 50% 0%, hsl(42 60% 16% / 0.7) 0%, hsl(255 14% 6%) 60%)"
    : isHigh
    ? "radial-gradient(120% 80% at 50% 0%, hsl(270 50% 16% / 0.6) 0%, hsl(255 14% 6%) 60%)"
    : "radial-gradient(120% 80% at 50% 0%, hsl(255 14% 11%) 0%, hsl(255 14% 5%) 60%)";

  const earnedBadges = (allBadges || []).filter((b) => earnedBadgeIds?.includes(b.id));

  const handleShare = async () => {
    const url = `${window.location.origin}/u/${profile.username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${profile.username} on The W Tracker`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      }
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="min-h-screen pb-6 relative">
      <AmbientParticles />

      {/* Hero */}
      <div
        className="relative px-4 pt-12 pb-6 overflow-hidden"
        style={{ background: heroBg }}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[120%] h-64 blur-3xl opacity-60",
            isLegend && "bg-[radial-gradient(ellipse_at_center,hsl(280_70%_55%/0.4),transparent_70%)]",
            isApex && "bg-[radial-gradient(ellipse_at_center,hsl(18_95%_58%/0.35),transparent_70%)]",
            isElite && !isApex && !isLegend && "bg-[radial-gradient(ellipse_at_center,hsl(var(--gold)/0.3),transparent_70%)]",
            isHigh && "bg-[radial-gradient(ellipse_at_center,hsl(var(--purple)/0.3),transparent_70%)]",
          )}
        />

        <div className="relative z-10 flex items-center justify-between mb-6 safe-top">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} /> Back
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-full border border-border/50 bg-card/40 backdrop-blur-sm"
          >
            <Share2 size={12} /> Share
          </button>
        </div>

        <div className="relative z-10 text-center">
          {/* Brand kicker */}
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-gold/70 mb-3">
            The W Tracker
          </p>

          {/* Avatar — large, gold ring with offset */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative inline-block mb-5"
          >
            <div className="absolute inset-0 -m-3 rounded-full bg-gold/35 blur-2xl" aria-hidden />
            <div className="relative">
              <StatusAvatar
                src={profile.avatar_url}
                name={profile.username}
                tier={profile.status_tier || 'recruit'}
                size="xl"
              />
            </div>
          </motion.div>

          {/* PREMIUM ribbon — Founding Apex subscribers */}
          {isApexSubscriber && (
            <div className="mb-2 flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-sm text-[10px] font-black uppercase tracking-[0.22em] bg-gradient-to-r from-gold via-[hsl(42_90%_70%)] to-gold text-[hsl(260_18%_4%)] border border-gold shadow-[0_0_14px_hsl(var(--gold)/0.55)]">
                <Crown size={11} strokeWidth={3} />
                Premium · Day-One
              </span>
            </div>
          )}

          {/* Username — colored by status tier */}
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={cn(
              "font-display text-[34px] leading-none font-black tracking-tight",
              getTierUsernameClass(profile.status_tier || 'recruit'),
            )}
          >
            @{profile.username}
            {isOwnProfile && <span className="text-xs text-gold/70 ml-1.5 font-semibold align-middle">(you)</span>}
          </motion.h1>
          {profile.display_name && (
            <p className="text-sm text-muted-foreground mt-1.5">{profile.display_name}</p>
          )}

          {/* MASSIVE status nameplate — the loudest element on the page */}
          <div className="mt-5">
            <StatusNameplate
              tier={profile.status_tier || 'recruit'}
              rank={globalRank?.rank}
              totalUsers={globalRank?.total}
              size="md"
            />
          </div>

          {/* Status pills — Apex/Legend supersede Elite (no duplicates) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-2 mt-4"
          >
            {isApex ? (
              <ApexBadge isFounding={isApexSubscriber} size="md" />
            ) : isLegend ? (
              <ApexBadge tier="legend" size="md" />
            ) : profile.is_elite ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/45 bg-gold/5">
                <Crown size={12} className="text-gold" />
                <span className="text-[11px] font-black text-gold tracking-wider uppercase">Elite</span>
              </span>
            ) : null}
            <span className="inline-flex items-center px-3 py-1.5 rounded-full">
              <span className="text-[11px] font-black tracking-wider text-muted-foreground/80 uppercase">
                Level {profile.level}
              </span>
            </span>
            {championHistory && championHistory.wins > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/45 bg-gold/5">
                <Trophy size={12} className="text-gold" />
                <span className="text-[11px] font-black text-gold tracking-wider uppercase">
                  Season Champion{championHistory.wins > 1 ? ` ×${championHistory.wins}` : ''}
                </span>
              </span>
            )}
            {isLegendPinned && !isLegend && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[hsl(280_70%_60%)]/45 bg-[hsl(280_70%_55%)]/10">
                <Crown size={12} className="text-[hsl(280_70%_70%)]" />
                <span className="text-[11px] font-black tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-[hsl(280_70%_70%)] via-gold to-[hsl(350_80%_60%)]">
                  Founders Circle
                </span>
              </span>
            )}
          </motion.div>

          {/* Activity pulse — live signal */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-3 flex justify-center"
          >
            <ProfileActivityPulse userId={userId!} />
          </motion.div>

          {/* Hero XP — massive */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-6 flex flex-col items-center"
          >
            <p className="font-display font-black text-[64px] leading-none text-gold drop-shadow-[0_0_24px_hsl(42_78%_54%/0.55)] tabular-nums">
              {profile.xp.toLocaleString().replace(/,/g, " ")}
            </p>
            <p className="text-[10px] font-black tracking-[0.32em] text-gold/70 mt-2">TOTAL XP</p>
          </motion.div>

          {/* Tier message — italic, evocative */}
          <p className="text-sm text-muted-foreground/70 font-medium italic mt-5 max-w-[280px] mx-auto">
            {tier.message}
          </p>

          {/* Featured badge title */}
          {featuredBadge && (
            <div className="mt-4 flex justify-center">
              <FeaturedBadgeHero
                name={featuredBadge.name}
                icon={featuredBadge.icon}
                rarity={featuredBadge.rarity as any}
              />
            </div>
          )}

          {/* Global rank position */}
          {globalRank && globalRank.total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold/25 bg-gold/5"
            >
              <Medal size={11} className="text-gold" />
              <span className="text-[10px] font-black tracking-wider text-gold">
                #{globalRank.rank.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold">
                of {globalRank.total.toLocaleString()}
              </span>
            </motion.div>
          )}

          {/* Bottom hairline divider */}
          <div className="pointer-events-none mx-auto mt-6 h-px w-3/4 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
        </div>
      </div>

      <div className="px-4 -mt-2">
        {!isOwnProfile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-4 mt-4 space-y-2"
          >
            <div className="flex gap-2">
              {!friendship ? (
                <Button variant="secondary" size="sm" className="rounded-full" onClick={() => handleFriendAction("send")}>
                  <UserPlus size={14} /> Add Friend
                </Button>
              ) : friendship.status === "pending" && friendship.requester_id === myProfile?.user_id ? (
                <Button variant="secondary" size="sm" className="rounded-full opacity-70" onClick={() => handleFriendAction("cancel")}>
                  <Clock size={14} /> Pending
                </Button>
              ) : friendship.status === "pending" && friendship.addressee_id === myProfile?.user_id ? (
                <div className="flex gap-1.5">
                  <Button variant="gold" size="sm" className="rounded-full" onClick={() => handleFriendAction("accept")}>
                    <UserCheck size={14} /> Accept
                  </Button>
                  <Button variant="secondary" size="sm" className="rounded-full" onClick={() => handleFriendAction("decline")}>
                    <UserX size={14} />
                  </Button>
                </div>
              ) : friendship.status === "accepted" ? (
                <Button variant="secondary" size="sm" className="rounded-full border-[hsl(var(--teal))]/30 text-[hsl(var(--teal))]" onClick={() => handleFriendAction("remove")}>
                  <UserCheck size={14} /> Friends
                </Button>
              ) : (
                <Button variant="secondary" size="sm" className="rounded-full" onClick={() => handleFriendAction("send")}>
                  <UserPlus size={14} /> Add Friend
                </Button>
              )}
              <Button variant="gold" size="sm" className="flex-1 rounded-full" onClick={() => setShowBattleModal(true)}>
                <Swords size={14} /> Challenge
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1 rounded-full" onClick={() => navigate(`/chat/${userId}`)}>
                <MessageCircle size={14} /> Message
              </Button>
              <Button variant="secondary" size="sm" className="flex-1 rounded-full" onClick={() => navigate(`/badges/compare?user=${profile.username}`)}>
                <GitCompare size={14} /> Compare
              </Button>
            </div>
          </motion.div>
        )}

        {showBattleModal && profile && (
          <BattleChallengeModal
            username={profile.username}
            userId={userId!}
            myUserId={myProfile?.user_id || ""}
            battleType={battleType}
            setBattleType={setBattleType}
            duration={duration}
            setDuration={setDuration}
            creating={creating}
            onClose={() => setShowBattleModal(false)}
            onChallenge={async () => {
              if (!myProfile) return;
              setCreating(true);
              try {
                await supabase.from("battles").insert({
                  challenger_id: myProfile.user_id,
                  opponent_id: userId!,
                  battle_type: battleType,
                  duration_days: duration,
                });
                toast.success(`Challenge sent to @${profile.username}! ⚔️`);
                setShowBattleModal(false);
              } catch {
                toast.error("Failed to send challenge");
              }
              setCreating(false);
            }}
          />
        )}

        {/* Head-to-head comparison (only when viewing another user) */}
        {!isOwnProfile && myProfile && (
          <HeadToHead
            me={{
              username: myProfile.username,
              xp: myProfile.xp,
              streak: myProfile.streak,
              level: myProfile.level,
              rank_score: Number(myProfile.rank_score) || 0,
            }}
            them={{
              username: profile.username,
              xp: profile.xp,
              streak: profile.streak,
              level: profile.level,
              rank_score: Number(profile.rank_score) || 0,
            }}
          />
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="grid grid-cols-2 gap-3 mb-6 mt-2"
        >
          <StatCard icon={Zap} label="Total XP" value={profile.xp.toLocaleString()} variant="gold" />
          <StreakDisplay streak={profile.streak} longestStreak={profile.longest_streak} lastCheckinAt={null} />
          <StatCard icon={Award} label="Battles Won" value={battleStats?.won || 0} variant="rose" />
          <StatCard icon={Shield} label="Badges" value={earnedBadgeIds?.length || 0} variant="purple" />
        </motion.div>

      {/* Champion History */}
      {championHistory && championHistory.wins > 0 && (
        <div className="mb-6 animate-reveal animate-reveal-delay-1">
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
                  <span className="text-gold font-semibold">{s.points.toLocaleString()} XP</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Earned Badges */}
      <div className="animate-reveal animate-reveal-delay-2">
        <h2 className="font-display font-bold text-sm mb-3 tracking-tight">
          Badges ({earnedBadges.length})
        </h2>
        {earnedBadges.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 text-center py-6">No badges earned yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {earnedBadges.map((badge) => (
              <BadgeCard
                key={badge.id}
                name={badge.name}
                icon={badge.icon}
                rarity={badge.rarity}
                earned
                description={badge.description || undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* User Posts */}
      {userPosts && userPosts.length > 0 && (
        <div className="mt-6 animate-reveal animate-reveal-delay-3">
          <h2 className="font-display font-bold text-sm mb-3 tracking-tight">Posts ({userPosts.length})</h2>
          <div className="space-y-3">
            {userPosts.map((post) => (
              <div key={post.id} className="rounded-xl border border-border bg-card p-4">
                {post.content && <p className="text-sm mb-2">{post.content}</p>}
                {post.image_url && (
                  <img src={post.image_url} alt="Post" className="w-full rounded-lg object-cover max-h-48 mb-2" />
                )}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart size={10} /> {post.likes_count}</span>
                  <span className="flex items-center gap-1"><MessageSquare size={10} /> {post.comments_count}</span>
                  <span className="ml-auto">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

const BATTLE_TYPES = [
  { id: "xp", label: "Total XP", emoji: "⚡", icon: Zap, description: "Most XP earned wins" },
  { id: "cold_shower", label: "Cold Showers", emoji: "🧊", icon: Snowflake, description: "Most cold showers" },
  { id: "workout", label: "Workouts", emoji: "💪", icon: Dumbbell, description: "Most workouts done" },
  { id: "meditation", label: "Meditation", emoji: "🧘", icon: Brain, description: "Most meditation sessions" },
  { id: "hydration", label: "Hydration", emoji: "💧", icon: Droplets, description: "Most liters of water" },
  { id: "streak", label: "Streak", emoji: "🔥", icon: Flame, description: "Longest streak during battle" },
];

const DURATIONS = [3, 7, 14, 30];

const BattleChallengeModal = ({
  username, battleType, setBattleType, duration, setDuration, creating, onClose, onChallenge,
}: {
  username: string; userId: string; myUserId: string;
  battleType: string; setBattleType: (v: string) => void;
  duration: number; setDuration: (v: number) => void;
  creating: boolean; onClose: () => void; onChallenge: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
    <div
      className="w-full max-w-md bg-card border-t border-border rounded-t-3xl p-6 animate-reveal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
      <h2 className="font-display font-bold text-lg mb-1">Challenge @{username}</h2>
      <p className="text-xs text-muted-foreground mb-4">Pick a battle type and duration</p>

      {/* Battle types */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {BATTLE_TYPES.map((bt) => {
          const Icon = bt.icon;
          const selected = battleType === bt.id;
          return (
            <button
              key={bt.id}
              onClick={() => setBattleType(bt.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl border p-3 text-left transition-all active:scale-[0.97]",
                selected ? "border-gold/40 bg-gold/5" : "border-border bg-secondary/30 hover:bg-secondary/60"
              )}
            >
              <span className="text-lg">{bt.emoji}</span>
              <div>
                <p className={cn("text-xs font-semibold", selected && "text-gold")}>{bt.label}</p>
                <p className="text-[10px] text-muted-foreground">{bt.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Duration */}
      <p className="text-xs font-semibold mb-2 flex items-center gap-1"><Clock size={12} /> Duration</p>
      <div className="flex gap-2 mb-5">
        {DURATIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDuration(d)}
            className={cn(
              "flex-1 rounded-lg border py-2 text-xs font-bold transition-all active:scale-95",
              duration === d ? "border-gold/40 bg-gold/10 text-gold" : "border-border bg-secondary/30"
            )}
          >
            {d}d
          </button>
        ))}
      </div>

      <Button variant="gold" className="w-full rounded-full" onClick={onChallenge} disabled={creating}>
        <Swords size={14} />
        {creating ? "Sending..." : "Send Challenge"}
      </Button>
    </div>
  </div>
);

export default UserProfile;
