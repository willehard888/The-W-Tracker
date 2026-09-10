import { fmtUnit } from "@/lib/format";
import { useParams, useNavigate } from "react-router-dom";
import { backOr } from "@/lib/nav";
import { SubPageSkeleton } from "@/components/skeletons/PageSkeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFriendActions } from "@/hooks/use-friends";
import { Award, Swords, MessageCircle, Clock, GitCompare, UserPlus, UserCheck, UserX, Heart, MessageSquare, Medal, Share2, Ban, Flag, MoreVertical, UserRound } from "lucide-react";
import { useBlockActions } from "@/hooks/use-blocking";
import BlockUserDialog from "@/components/BlockUserDialog";
import BattleChallengeModal from "@/components/battles/BattleChallengeModal";
import ImageLightbox from "@/components/ImageLightbox";
import GridMedia from "@/components/feed/GridMedia";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import BadgeCard from "@/components/BadgeCard";
import EmptyState from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import HeadToHead from "@/components/HeadToHead";
import ProfileActivityPulse from "@/components/ProfileActivityPulse";
import IdentityCore from "@/components/profile/IdentityCore";
import { useMyRank } from "@/hooks/use-my-rank";
import { getTierConfig, getTierHeroSurface, formatTier, type StatusTier } from "@/lib/status-tiers";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";

/**
 * /user/:userId — another athlete, proven. Same thesis as /u/: the beat
 * names the rung and the best streak, the shared identity block is the
 * hero, and everything you can do to them is one strip under it.
 */
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
  // The friend button pops once a choice has landed, never on entrance.
  const [landed, setLanded] = useState(false);

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
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

  // The graph's writes live in useFriendActions, and this screen used to hold
  // a second copy of them that disagreed: declining here set status='declined'
  // (a dead end the requester could never get past) while every other surface
  // deletes the row so they can ask again. One implementation now.
  const { sendRequest, acceptRequest, declineRequest, removeFriend, invalidate } = useFriendActions();

  const handleFriendAction = async (action: "send" | "accept" | "decline" | "cancel" | "remove") => {
    if (!myProfile || !userId) return;
    try {
      if (action === "send") {
        await sendRequest(userId);
        toast.success("Friend request sent! 🤝");
      } else if (action === "accept" && friendship) {
        await acceptRequest(friendship.id);
        toast.success("Friend request accepted! 🎉");
      } else if (action === "decline" && friendship) {
        await declineRequest(friendship.id);
        toast("Request declined");
      } else if (action === "cancel" && friendship) {
        // Cancelling your own outgoing request is the same delete.
        await declineRequest(friendship.id);
        toast("Request cancelled");
      } else if (action === "remove") {
        await removeFriend(userId);
        toast("Friend removed");
      }
      setLanded(true);
      queryClient.invalidateQueries({ queryKey: ["friendship"] });
      invalidate();
    } catch (e) {
      toast.error(friendlyError(e, "Something went wrong"));
    }
  };

  const areFriends = friendship?.status === "accepted";

  if (isLoading) return <SubPageSkeleton />;

  if (isError || !profile) {
    return (
      <div className="min-h-full">
        <PageBar onBack={() => backOr(navigate, "/squad")} />
        <div className="px-4 pt-6">
          {isError ? (
            <ErrorState title="Couldn't load this profile" onRetry={refetch} />
          ) : (
            <EmptyState
              icon={UserRound}
              title="User not found"
              action={
                <Button variant="gold-outline" size="sm" className="min-h-11" onClick={() => backOr(navigate, "/squad")}>
                  Back to Squad
                </Button>
              }
            />
          )}
        </div>
      </div>
    );
  }

  const isOwnProfile = myProfile?.user_id === userId;
  const tierKey = profile.status_tier || 'recruit';
  const tier = getTierConfig(tierKey);
  // One shared tier ladder for every profile hero (same as /profile).
  const heroSurface = getTierHeroSurface(tierKey);
  const best = profile.longest_streak ?? 0;

  const earnedBadges = (allBadges || []).filter((b) => earnedBadgeIds?.includes(b.id));

  const incoming = friendship?.status === "pending" && friendship.addressee_id === myProfile?.user_id;
  const sent = friendship?.status === "pending" && friendship.requester_id === myProfile?.user_id;
  const friendState = areFriends ? "friends" : incoming ? "incoming" : sent ? "sent" : "none";

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
    <div className="min-h-full">
      <PageBar
        title={`@${profile.username}`}
        onBack={() => backOr(navigate, "/squad")}
        action={
          <Button variant="ghost" size="icon" aria-label="Share profile" onClick={handleShare}>
            <Share2 size={18} aria-hidden />
          </Button>
        }
      />

      <div className="px-4 pt-3 pb-6">
        {/* ── OPENING BEAT — the rung and the proof, stated once ── */}
        <div className="home-rise mb-5">
          <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
            {best > 0 ? `${formatTier(tierKey, profile.tier_division)}. ${best}-day best.` : `${tier.label}. Day one.`}
          </h2>
        </div>

        {/* ── HERO — the shared identity block, on the tier surface ── */}
        <div className={cn("home-rise home-rise-1 relative overflow-hidden rounded-3xl border p-6 pt-8 pb-7", heroSurface.bgClass)}>
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
        </div>

        {/* ── ACTIONS — everything you can do to them, one strip ── */}
        {!isOwnProfile && (
          <div className="home-rise home-rise-2 mt-4 flex items-center gap-1.5">
            <div key={friendState} className={cn("flex-1 min-w-0 flex items-center gap-1.5", landed && "commit-pop")}>
              {friendState === "friends" ? (
                <Button variant="gold-outline" size="sm" className="flex-1 min-h-11" onClick={() => handleFriendAction("remove")}>
                  <UserCheck size={15} aria-hidden /> Friends
                </Button>
              ) : friendState === "incoming" ? (
                <>
                  <Button variant="ember" size="sm" className="flex-1 min-h-11" onClick={() => handleFriendAction("accept")}>
                    <UserCheck size={15} aria-hidden /> Accept
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Decline request" onClick={() => handleFriendAction("decline")}>
                    <UserX size={18} aria-hidden />
                  </Button>
                </>
              ) : friendState === "sent" ? (
                <Button variant="secondary" size="sm" className="flex-1 min-h-11" onClick={() => handleFriendAction("cancel")}>
                  <Clock size={14} aria-hidden /> Pending
                </Button>
              ) : (
                <Button variant="ember" size="sm" className="flex-1 min-h-11" onClick={() => handleFriendAction("send")}>
                  <UserPlus size={15} aria-hidden /> Add friend
                </Button>
              )}
            </div>
            <Button variant="ghost" size="icon" aria-label="Message" onClick={() => navigate(`/chat/${userId}`)}>
              <MessageCircle size={18} aria-hidden />
            </Button>
            {/* Challenge — battle is friends-only */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Challenge to a battle"
              className={cn(areFriends && "text-ember")}
              onClick={() =>
                areFriends
                  ? setShowBattleModal(true)
                  : toast(`Add @${profile.username} as a friend to battle them`)
              }
            >
              <Swords size={18} aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Compare badges" onClick={() => navigate(`/badges/compare?user=${profile.username}`)}>
              <GitCompare size={18} aria-hidden />
            </Button>
            {/* Report + block (App Store 1.2) live behind the one menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreVertical size={18} aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => report("profile", userId!, userId!, `Reported profile @${profile.username}`)}>
                  <Flag aria-hidden size={14} className="mr-2 text-muted-foreground" /> Report
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowBlockConfirm(true)}>
                  <Ban aria-hidden size={14} className="mr-2" /> Block
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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

        {/* ── HEAD TO HEAD — you against them ── */}
        {!isOwnProfile && myProfile && (
          <div className="home-rise home-rise-3 mt-4">
            <HeadToHead
              me={{
                username: myProfile.username,
                xp: myProfile.xp,
                streak: myProfile.streak,
                level: myProfile.level,
                rank_score: Number(myProfile.rank_score) || 0,
                avatarUrl: myProfile.avatar_url,
                tier: myProfile.status_tier,
              }}
              them={{
                username: profile.username,
                xp: profile.xp,
                streak: profile.streak,
                level: profile.level,
                rank_score: Number(profile.rank_score) || 0,
                avatarUrl: profile.avatar_url,
                tier: profile.status_tier,
              }}
            />
          </div>
        )}

        {/* ── PROOF — the media grid, edge to edge ── */}
        {mediaPosts && mediaPosts.length > 0 && (
          <div className="home-rise home-rise-4 mt-7">
            <p className="text-[11px] font-bold text-muted-foreground mb-2">Posts · {mediaPosts.length}</p>
            <div className="-mx-4 grid grid-cols-3 gap-[2px]">
              {mediaPosts.map((p: any) => {
                const isVideo = !!p.video_url;
                const src = p.image_url || p.video_url;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      setLightboxUrl(src);
                      setLightboxPost(p);
                    }}
                    className="group relative aspect-square overflow-hidden bg-secondary"
                  >
                    <GridMedia src={src} isVideo={isVideo} alt={`@${profile.username} post`} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                      <span className="flex items-center gap-1 text-[12px] font-black text-foreground">
                        <Heart size={12} fill="currentColor" aria-hidden />
                        {p.likes_count ?? 0}
                      </span>
                      <span className="flex items-center gap-1 text-[12px] font-black text-foreground">
                        <MessageSquare size={12} fill="currentColor" aria-hidden />
                        {p.comments_count ?? 0}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CHAMPION HISTORY — a quiet ledger ── */}
        {championHistory && championHistory.wins > 0 && (
          <div className="mt-7 surface-card surface-card-quiet px-4 py-3">
            <div className="flex items-center gap-2">
              <Medal size={14} className="text-muted-foreground shrink-0" aria-hidden />
              <h2 className="flex-1 text-[13px] font-bold">Season Champion</h2>
              <span className="font-display font-black text-[17px] tabular-nums leading-none">{championHistory.wins}×</span>
            </div>
            <div className="mt-1 divide-y divide-border/35">
              {championHistory.seasons.map((s: any, i: number) => (
                <div key={i} className="py-2 flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-semibold tabular-nums">{fmtUnit(s.points, "XP")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BADGES ── */}
        <div className="mt-7">
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
        tier={tierKey as StatusTier}
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
          backOr(navigate, "/squad");
        }}
      />
    </div>
  );
};

export default UserProfile;
