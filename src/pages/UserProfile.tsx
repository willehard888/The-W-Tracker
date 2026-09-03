import { useParams, useNavigate } from "react-router-dom";
import { ProfileSkeleton } from "@/components/skeletons/PageSkeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Award, ChevronLeft, Swords, MessageCircle, Clock, GitCompare, UserPlus, UserCheck, UserX, Heart, MessageSquare, Medal, Share2, Camera, Ban, Flag } from "lucide-react";
import { useBlockActions } from "@/hooks/use-blocking";
import BlockUserDialog from "@/components/BlockUserDialog";
import BattleChallengeModal from "@/components/battles/BattleChallengeModal";
import ImageLightbox from "@/components/ImageLightbox";
import GridMedia from "@/components/feed/GridMedia";
import { Button } from "@/components/ui/button";
import BadgeCard from "@/components/BadgeCard";
import EmptyState from "@/components/ui/empty-state";
import HeadToHead from "@/components/HeadToHead";
import ProfileActivityPulse from "@/components/ProfileActivityPulse";
import IdentityCore from "@/components/profile/IdentityCore";
import { useMyRank } from "@/hooks/use-my-rank";
import { getTierConfig, getTierHeroSurface, type StatusTier } from "@/lib/status-tiers";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";


const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { profile: myProfile } = useAuth();
  const navigate = useNavigate();
  const { block, report } = useBlockActions();
  const queryClient = useQueryClient();
  const [showBattleModal, setShowBattleModal] = useState(false);
  const [battleType, setBattleType] = useState("xp");
  const [duration, setDuration] = useState(7);
  const [creating, setCreating] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxPost, setLightboxPost] = useState<any>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

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

  // Elite Feed media posts — IG-style grid, the loudest social proof on the profile
  const { data: mediaPosts } = useQuery({
    queryKey: ["user-media-posts", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("feed_posts")
        .select("id, content, image_url, video_url, likes_count, comments_count, kudos_count, created_at")
        .eq("user_id", userId!)
        .or("image_url.not.is.null,video_url.not.is.null")
        .order("created_at", { ascending: false })
        .limit(18);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: championHistory } = useQuery({
    queryKey: ["champion-history", userId],
    queryFn: async () => {
      const [{ data: champions }, { data: seasons }] = await Promise.all([
        supabase.from("leaderboard_champions").select("season_id, season_points, created_at").eq("user_id", userId!).order("created_at", { ascending: false }),
        supabase.from("leaderboard_seasons").select("id, name"),
      ]);
      const seasonNames = new Map<string, string>((seasons || []).map((s) => [s.id, s.name]));
      return {
        wins: (champions || []).length,
        seasons: (champions || []).map((c) => ({
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
      if (!profile?.featured_badge_id) return null;
      const { data } = await supabase
        .from("badges")
        .select("name, icon, rarity")
        .eq("id", profile.featured_badge_id)
        .maybeSingle();
      return data;
    },
  });

  // Global rank — same get_user_rank RPC as /profile, so the same user can
  // never see two different rank numbers on two surfaces.
  const { data: rankData } = useMyRank(userId);
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
      // supabase-js returns { error }, it does NOT throw — without these
      // checks an RLS denial showed "Friend request sent!" on a no-op.
      if (action === "send") {
        const { error } = await supabase.from("friendships").insert({ requester_id: myProfile.user_id, addressee_id: userId });
        if (error) throw error;
        toast.success("Friend request sent! 🤝");
      } else if (action === "accept" && friendship) {
        const { error } = await supabase.from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", friendship.id);
        if (error) throw error;
        toast.success("Friend request accepted! 🎉");
      } else if (action === "decline" && friendship) {
        const { error } = await supabase.from("friendships").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", friendship.id);
        if (error) throw error;
        toast("Request declined");
      } else if ((action === "cancel" || action === "remove") && friendship) {
        const { error } = await supabase.from("friendships").delete().eq("id", friendship.id);
        if (error) throw error;
        toast(action === "cancel" ? "Request cancelled" : "Friend removed");
      }
      ["friendship", "friends", "friends-list", "friend-requests",
       "sent-friend-requests", "friend-request-count"].forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k] }));
    } catch {
      toast.error("Something went wrong");
    }
  };

  const areFriends = friendship?.status === "accepted";

  if (isLoading) {
    return (
      <div className="min-h-full px-4 pt-4">
        <ProfileSkeleton />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-full pb-4 px-4 pt-6 text-center">
        <p className="text-muted-foreground mt-20">User not found</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} /> Go back
        </Button>
      </div>
    );
  }

  const isOwnProfile = myProfile?.user_id === userId;
  const tier = getTierConfig(profile.status_tier || 'recruit');
  // One shared tier ladder for every profile hero (same as /profile).
  const heroSurface = getTierHeroSurface(profile.status_tier || 'recruit');

  const earnedBadges = (allBadges || []).filter((b) => earnedBadgeIds?.includes(b.id));

  const handleShare = async () => {
    const url = `${window.location.origin}/u/${profile.username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${profile.username} on Whealth Factory`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      }
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="min-h-full pb-6 relative">
      {/* Hero — full-bleed variant of the shared tier surface */}
      <div
        className={cn(
          "relative px-4 pt-12 pb-6 overflow-hidden border-x-0 border-t-0 rounded-none",
          heroSurface.bgClass,
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[120%] h-64 blur-3xl opacity-60"
          style={{ background: heroSurface.glowStyle }}
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
          {/* Shared identity block — identical to /profile (page owns the
              background + entrance animation; rank comes from the same RPC) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <IdentityCore
              profile={profile}
              rankData={rankData}
              championWins={championHistory?.wins ?? 0}
              tierMessage={tier.message}
              featuredBadge={featuredBadge}
              nameplateSize="md"
              nameSuffix={
                isOwnProfile ? (
                  <span className="text-xs text-gold/70 ml-1.5 font-semibold align-middle">(you)</span>
                ) : undefined
              }
              afterPills={
                <div className="mt-3 flex justify-center">
                  <ProfileActivityPulse userId={userId!} />
                </div>
              }
            />
          </motion.div>

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
            className="mb-5 mt-4"
          >
            <div className="surface-card backdrop-blur-sm p-2.5 space-y-2">
              {/* Primary row — connect + battle */}
              <div className="grid grid-cols-2 gap-2">
                {/* Friend status (adapts) */}
                {(() => {
                  const incoming = friendship?.status === "pending" && friendship.addressee_id === myProfile?.user_id;
                  const sent = friendship?.status === "pending" && friendship.requester_id === myProfile?.user_id;
                  if (areFriends) {
                    return (
                      <Button variant="gold-outline" size="sm" onClick={() => handleFriendAction("remove")} className="w-full">
                        <UserCheck size={15} /> Friends
                      </Button>
                    );
                  }
                  if (incoming) {
                    return (
                      <div className="flex gap-1.5">
                        <Button variant="ember" size="sm" onClick={() => handleFriendAction("accept")} className="flex-1">
                          <UserCheck size={15} /> Accept
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleFriendAction("decline")} className="px-3" aria-label="Decline">
                          <UserX size={15} />
                        </Button>
                      </div>
                    );
                  }
                  if (sent) {
                    return (
                      <Button variant="secondary" size="sm" onClick={() => handleFriendAction("cancel")} className="w-full">
                        <Clock size={14} /> Pending
                      </Button>
                    );
                  }
                  return (
                    <Button variant="ember" size="sm" onClick={() => handleFriendAction("send")} className="w-full">
                      <UserPlus size={15} /> Add friend
                    </Button>
                  );
                })()}

                {/* Challenge — battle is friends-only */}
                <Button
                  variant={areFriends ? "ember" : "secondary"}
                  size="sm"
                  onClick={() =>
                    areFriends
                      ? setShowBattleModal(true)
                      : toast(`Add @${profile.username} as a friend to battle them`)
                  }
                  className="w-full"
                >
                  <Swords size={15} /> Challenge
                </Button>
              </div>

              {/* Secondary row — message + compare */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="gold-outline" size="sm" onClick={() => navigate(`/chat/${userId}`)} className="w-full">
                  <MessageCircle size={15} /> Message
                </Button>
                <Button variant="gold-outline" size="sm" onClick={() => navigate(`/badges/compare?user=${profile.username}`)} className="w-full">
                  <GitCompare size={15} /> Compare
                </Button>
              </div>

              {/* Safety row — report + block (App Store 1.2) */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={() => report("profile", userId!, userId!, `Reported profile @${profile.username}`)} className="w-full text-muted-foreground">
                  <Flag size={15} /> Report
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowBlockConfirm(true)}
                  className="w-full text-destructive"
                >
                  <Ban size={15} /> Block
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {showBattleModal && profile && (
          <BattleChallengeModal
            username={profile.username}
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
                const { error } = await supabase.rpc("create_battle", {
                  p_opponent: userId!,
                  p_battle_type: battleType,
                  p_duration_days: duration,
                });
                if (error) throw error;
                toast.success(`Challenge sent to @${profile.username}! ⚔️`);
                setShowBattleModal(false);
              } catch (e: any) {
                const key = e?.message?.match(/not_friends|self_battle|battle_exists|unauthorized/)?.[0];
                const msg = ({
                  not_friends: "You can only battle friends. Add them first.",
                  self_battle: "Can't challenge yourself!",
                  battle_exists: "You already have a battle going with them.",
                  unauthorized: "Please sign in.",
                } as Record<string, string>)[key] ?? "Failed to send challenge";
                toast.error(msg);
              }
              setCreating(false);
            }}
          />
        )}

        {/* Elite Feed media — IG-style 3-col grid, edge-to-edge */}
        {mediaPosts && mediaPosts.length > 0 && (
          <div className="mb-6 -mx-4 mt-2">
            <div className="flex items-center justify-center border-t border-border">
              <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border-t-2 border-foreground -mt-px">
                <Camera size={12} className="text-foreground" />
                <span className="text-[11px] font-black tracking-[0.22em] uppercase text-foreground">
                  Posts · {mediaPosts.length}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-[2px]">
              {mediaPosts.map((p: any, i) => {
                const isVideo = !!p.video_url;
                const src = p.image_url || p.video_url;
                return (
                  <motion.button
                    type="button"
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.05 + i * 0.02 }}
                    onClick={() => {
                      setLightboxUrl(src);
                      setLightboxPost(p);
                    }}
                    className="group relative aspect-square overflow-hidden bg-secondary"
                  >
                    <GridMedia src={src} isVideo={isVideo} alt={`@${profile.username} post`} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                      <span className="flex items-center gap-1 text-[12px] font-black text-foreground">
                        <Heart size={12} fill="currentColor" />
                        {p.likes_count ?? 0}
                      </span>
                      <span className="flex items-center gap-1 text-[12px] font-black text-foreground">
                        <MessageSquare size={12} fill="currentColor" />
                        {p.comments_count ?? 0}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
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
          <EmptyState size="compact" icon={Award} title="No badges earned yet" />
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

      </div>

      <ImageLightbox
        open={!!lightboxUrl}
        imageUrl={lightboxUrl}
        isVideo={!!lightboxPost?.video_url}
        username={profile.username}
        avatarUrl={profile.avatar_url}
        tier={(profile.status_tier || "recruit") as StatusTier}
        level={profile.level}
        streak={profile.streak}
        likes={lightboxPost?.likes_count}
        comments={lightboxPost?.comments_count}
        kudos={lightboxPost?.kudos_count}
        caption={lightboxPost?.content}
        onClose={() => {
          setLightboxUrl(null);
          setLightboxPost(null);
        }}
      />

      <BlockUserDialog
        open={showBlockConfirm}
        username={profile.username}
        onOpenChange={setShowBlockConfirm}
        onConfirm={() => {
          block(userId!, profile.username);
          navigate(-1);
        }}
      />
    </div>
  );
};

export default UserProfile;
