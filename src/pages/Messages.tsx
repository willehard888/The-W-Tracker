import { ActionRow } from "@/components/ActionRow";
import { Input } from "@/components/ui/input";
import { fmtRelative } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MessageCircle, UserCheck, UserPlus, Search, X, SearchX } from "lucide-react";
import StatusAvatar from "@/components/StatusAvatar";
import EmptyState from "@/components/ui/empty-state";
import TierUsername from "@/components/TierUsername";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import PullRefreshIndicator from "@/components/PullRefreshIndicator";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";

const Messages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const { scrollRef, pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd, PULL_THRESHOLD } = usePullRefresh([["friends"], ["conversations"]]);

  // Fetch accepted friends
  const { data: friends } = useQuery({
    queryKey: ["friends", user?.id],
    staleTime: 5 * 60_000,
    gcTime:    15 * 60_000,
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("friendships")
        .select("*")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted");
      if (!data || data.length === 0) return [];

      const friendIds = data.map((f) => f.requester_id === user.id ? f.addressee_id : f.requester_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier")
        .in("user_id", friendIds);
      return profiles || [];
    },
    enabled: !!user,
  });

  // Fetch pending incoming requests
  const { data: pendingRequests } = useQuery({
    queryKey: ["pending-friend-requests", user?.id],
    staleTime: 2 * 60_000,   // pending requests should be reasonably fresh
    gcTime:    10 * 60_000,
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("friendships")
        .select("*")
        .eq("addressee_id", user.id)
        .eq("status", "pending");
      if (!data || data.length === 0) return [];

      const requesterIds = data.map((f) => f.requester_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier")
        .in("user_id", requesterIds);
      return (data || []).map((f: any) => ({
        ...f,
        profile: (profiles || []).find((p) => p.user_id === f.requester_id),
      }));
    },
    enabled: !!user,
  });

  // Search users
  const { data: searchResults } = useQuery({
    queryKey: ["search-users", searchQuery],
    queryFn: async () => {
      if (!user || !searchQuery.trim()) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier, level")
        .neq("user_id", user.id)
        .ilike("username", `%${searchQuery.trim()}%`)
        .limit(10);
      return data || [];
    },
    enabled: !!user && searchQuery.trim().length >= 2,
  });

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    staleTime: 30_000,       // conversations should be reasonably real-time
    gcTime:    5 * 60_000,
    queryFn: async () => {
      if (!user) return [];
      const { data: msgs } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (!msgs || msgs.length === 0) return [];

      const convMap = new Map<string, { partnerId: string; lastMessage: any; unread: number }>();
      for (const msg of msgs) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, { partnerId, lastMessage: msg, unread: 0 });
        }
        const conv = convMap.get(partnerId)!;
        if (!msg.read && msg.receiver_id === user.id) {
          conv.unread++;
        }
      }

      const partnerIds = [...convMap.keys()];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier")
        .in("user_id", partnerIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));

      return [...convMap.values()].map((c) => ({
        ...c,
        profile: profileMap[c.partnerId],
      }));
    },
    enabled: !!user,
  });

  const friendIds = new Set((friends || []).map((f) => f.user_id));

  // Split conversations: friends first, then others
  const friendConvos = (conversations || []).filter((c) => friendIds.has(c.partnerId));
  const otherConvos = (conversations || []).filter((c) => !friendIds.has(c.partnerId));
  // Friends without conversations
  const friendsWithoutConvo = (friends || []).filter(
    (f) => !conversations?.some((c) => c.partnerId === f.user_id)
  );

  return (
    <div ref={scrollRef} className="min-h-full" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <PageBar title="Messages" onBack={() => navigate("/squad")} />

      <div className="px-4 pt-4 pb-6">
      <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} threshold={PULL_THRESHOLD} />

      {/* Search */}
      <div className="animate-reveal mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users…"
            className="h-11 rounded-xl pl-9 pr-9 text-[13px]"
          />
          {searchQuery && (
            <button aria-label="Clear search" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {searchQuery.trim().length >= 2 && searchResults && searchResults.length > 0 && (
        <div className="animate-reveal mb-4">
          <p className="eyebrow text-muted-foreground mb-2 flex items-center gap-1">
            <Search size={12} /> Results
          </p>
          <div className="space-y-2">
            {searchResults.map((u) => (
              <button
                key={u.user_id}
                onClick={() => { setSearchQuery(""); navigate(`/chat/${u.user_id}`); }}
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all active:scale-[0.98] card-depth"
              >
                <StatusAvatar src={u.avatar_url} name={u.username} tier={u.status_tier || 'recruit'} size="sm" animated={false} />
                <div className="flex-1 min-w-0">
                  <TierUsername
                    as="p"
                    username={u.username}
                    tier={u.status_tier || "recruit"}
                    className="text-sm font-semibold truncate"
                  />
                  <p className="text-xs text-muted-foreground/50">Lv {u.level || 1}</p>
                </div>
                <MessageCircle size={14} className="text-muted-foreground/30" />
              </button>
            ))}
          </div>
        </div>
      )}

      {searchQuery.trim().length >= 2 && searchResults && searchResults.length === 0 && (
        <div className="mb-4 animate-reveal">
          <EmptyState
            size="compact"
            icon={SearchX}
            title="No users found"
            description={`Nothing matched "${searchQuery.trim()}". Try a different handle.`}
          />
        </div>
      )}

      {/* Pending Friend Requests */}
      {pendingRequests && pendingRequests.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-1 mb-4">
          <p className="eyebrow text-muted-foreground mb-2 flex items-center gap-1">
            <UserPlus size={12} /> Friend Requests
          </p>
          <div className="space-y-2">
            {pendingRequests.map((req: any) => (
              <ActionRow
                key={req.id}
                leading={<StatusAvatar src={req.profile?.avatar_url} name={req.profile?.username} tier={req.profile?.status_tier || "recruit"} size="sm" animated={false} />}
                title={
                  <TierUsername
                    as="span"
                    username={req.profile?.username}
                    tier={req.profile?.status_tier || "recruit"}
                    className="text-sm font-semibold"
                  />
                }
                subtitle="Wants to be friends"
                onAccept={async () => {
                  const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", req.id);
                  if (error) { toast.error("Could not accept — try again."); return; }
                  queryClient.invalidateQueries({ queryKey: ["pending-friend-requests"] });
                  queryClient.invalidateQueries({ queryKey: ["friends"] });
                  queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
                  queryClient.invalidateQueries({ queryKey: ["conversations"] });
                }}
                onDecline={async () => {
                  const { error } = await supabase.from("friendships").update({ status: "declined" }).eq("id", req.id);
                  if (error) { toast.error("Could not decline — try again."); return; }
                  queryClient.invalidateQueries({ queryKey: ["pending-friend-requests"] });
                  queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Friends Section */}
      {(friends && friends.length > 0) && (
        <div className="animate-reveal animate-reveal-delay-1 mb-4">
          <p className="eyebrow text-muted-foreground mb-2 flex items-center gap-1">
            <UserCheck size={12} /> Friends
          </p>

          {/* Friends with conversations */}
          <div className="space-y-2">
            {friendConvos.map((conv) => (
              <ConversationRow key={conv.partnerId} conv={conv} userId={user?.id} navigate={navigate} isFriend />
            ))}
            {/* Friends without conversations */}
            {friendsWithoutConvo.map((friend) => (
              <button
                key={friend.user_id}
                onClick={() => navigate(`/chat/${friend.user_id}`)}
                className="w-full flex items-center gap-3 rounded-xl border border-[hsl(var(--teal))]/15 bg-card p-4 text-left transition-all active:scale-[0.98] card-depth"
              >
                <StatusAvatar src={friend.avatar_url} name={friend.username} tier={friend.status_tier || 'recruit'} size="sm" animated={false} />
                <div className="flex-1 min-w-0">
                  <TierUsername
                    as="p"
                    username={friend.username}
                    tier={friend.status_tier || "recruit"}
                    className="text-sm font-semibold truncate"
                  />
                  <p className="text-xs text-muted-foreground/50">Start a conversation</p>
                </div>
                <MessageCircle size={14} className="text-muted-foreground/30" />
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 skeleton-block flex gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-secondary rounded" />
                <div className="h-2 w-40 bg-secondary rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Other Conversations */}
      {otherConvos.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-2">
          {friends && friends.length > 0 && (
            <p className="eyebrow text-muted-foreground mb-2">Others</p>
          )}
          <div className="space-y-2">
            {otherConvos.map((conv) => (
              <ConversationRow key={conv.partnerId} conv={conv} userId={user?.id} navigate={navigate} />
            ))}
          </div>
        </div>
      )}

      {!isLoading && (!conversations || conversations.length === 0) && (!friends || friends.length === 0) && (
        <div className="animate-reveal animate-reveal-delay-1">
          <EmptyState
            icon={MessageCircle}
            title="No messages yet"
            description="Open someone's profile and tap Message to start a conversation."
          />
        </div>
      )}
      </div>
    </div>
  );
};

const ConversationRow = ({ conv, userId, navigate, isFriend }: { conv: any; userId?: string; navigate: any; isFriend?: boolean }) => (
  <button
    onClick={() => navigate(`/chat/${conv.partnerId}`)}
    className={cn(
      "w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-all active:scale-[0.98] card-depth",
      conv.unread > 0
        ? "border-gold/30 bg-gold/5"
        : isFriend
          ? "border-[hsl(var(--teal))]/15 bg-card"
          : "border-border bg-card"
    )}
  >
    <StatusAvatar src={conv.profile?.avatar_url} name={conv.profile?.username} tier={conv.profile?.status_tier || 'recruit'} size="sm" animated={false} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <TierUsername
          as="p"
          username={conv.profile?.username}
          tier={conv.profile?.status_tier || "recruit"}
          className={cn("text-sm font-semibold truncate", conv.unread > 0 && "text-foreground")}
        />
        <span className="text-[11px] text-muted-foreground shrink-0">
          {fmtRelative(conv.lastMessage.created_at)}
        </span>
      </div>
      <p className={cn(
        "text-xs truncate mt-0.5",
        conv.unread > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground"
      )}>
        {conv.lastMessage.sender_id === userId && "You: "}
        {conv.lastMessage.content}
      </p>
    </div>
    {conv.unread > 0 && (
      <div className="h-5 min-w-5 px-1.5 rounded-full bg-ember flex items-center justify-center">
        <span className="text-[11px] font-bold text-white">{conv.unread}</span>
      </div>
    )}
  </button>
);

export default Messages;
