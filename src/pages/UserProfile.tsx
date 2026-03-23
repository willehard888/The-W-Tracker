import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Flame, Zap, Award, Shield, ChevronLeft, Swords, MessageCircle, Snowflake, Dumbbell, Brain, Droplets, Clock, GitCompare, UserPlus, UserCheck, UserX, Heart, MessageSquare } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/StatCard";
import StreakDisplay from "@/components/StreakDisplay";
import BadgeCard from "@/components/BadgeCard";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { profile: myProfile, isElite } = useAuth();
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

  // Friendship status
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
      <div className="min-h-screen pb-24 px-4 pt-6 text-center">
        <p className="text-muted-foreground mt-20">User not found</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} /> Go back
        </Button>
      </div>
    );
  }

  const isOwnProfile = myProfile?.user_id === userId;
  const tierLabel =
    profile.status_tier === "elite" ? "Elite" :
    profile.status_tier === "high_performer" ? "High Performer" :
    profile.status_tier === "rising" ? "Rising" : "Normal";

  const tierColor =
    profile.status_tier === "elite" ? "text-gold bg-gold/10 border-gold/20" :
    profile.status_tier === "high_performer" ? "text-purple-400 bg-purple-500/10 border-purple-500/20" :
    profile.status_tier === "rising" ? "text-sky-400 bg-sky-500/10 border-sky-500/20" :
    "text-muted-foreground bg-secondary border-border";

  const earnedBadges = (allBadges || []).filter((b) => earnedBadgeIds?.includes(b.id));

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ChevronLeft size={16} />
        Back
      </button>

      {/* Profile Header */}
      <div className="animate-reveal text-center mb-6">
        <Avatar className={cn(
          "h-20 w-20 mx-auto mb-3 ring-2",
          profile.status_tier === "elite" ? "ring-gold/40" : "ring-border/30"
        )}>
          {profile.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt={profile.username} />
          ) : null}
          <AvatarFallback className="text-3xl font-black font-display gradient-gold text-primary-foreground">
            {profile.username?.charAt(0)?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <h1 className="font-display text-xl font-bold tracking-tight">
          @{profile.username}
          {isOwnProfile && <span className="text-xs text-gold/70 ml-1">(you)</span>}
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full border", tierColor)}>
            {tierLabel}
          </span>
          <span className="text-xs text-muted-foreground">• Level {profile.level}</span>
        </div>
      </div>

      {/* Action buttons */}
      {!isOwnProfile && (
        <>
          <div className="animate-reveal animate-reveal-delay-1 mb-3 flex gap-2">
            {/* Friend button */}
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
          <div className="animate-reveal animate-reveal-delay-1 mb-3 flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1 rounded-full" onClick={() => navigate(`/chat/${userId}`)}>
              <MessageCircle size={14} /> Message
            </Button>
            <Button variant="secondary" size="sm" className="flex-1 rounded-full" onClick={() => navigate(`/badges/compare?user=${profile.username}`)}>
              <GitCompare size={14} /> Compare Badges
            </Button>
          </div>
        </>
      )}

      {/* Battle Type Modal */}
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

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-reveal animate-reveal-delay-1">
        <StatCard icon={Zap} label="Total XP" value={profile.xp.toLocaleString()} variant="gold" />
        <StreakDisplay streak={profile.streak} longestStreak={profile.longest_streak} />
        <StatCard icon={Award} label="Battles Won" value={battleStats?.won || 0} variant="rose" />
        <StatCard icon={Shield} label="Badges" value={earnedBadgeIds?.length || 0} variant="purple" />
      </div>

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
