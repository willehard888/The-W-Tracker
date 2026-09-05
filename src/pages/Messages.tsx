import { ActionRow } from "@/components/ActionRow";
import { Input } from "@/components/ui/input";
import { fmtInt, fmtRelative } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Search, X, SearchX } from "lucide-react";
import StatusAvatar from "@/components/StatusAvatar";
import EmptyState from "@/components/ui/empty-state";
import TierUsername from "@/components/TierUsername";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import PullRefreshIndicator from "@/components/PullRefreshIndicator";
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

  const unread = (conversations || []).reduce((n, c) => n + c.unread, 0);
  const searching = searchQuery.trim().length >= 2;
  const invalidate = (...keys: string[]) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  // One hairline list: friends' threads, friends you haven't written to, then
  // everyone else under the screen's single eyebrow.
  const rows: { key: string; node: ReactNode }[] = [
    ...friendConvos.map((c) => ({ key: c.partnerId, node: <ConversationRow conv={c} userId={user?.id} navigate={navigate} isFriend /> })),
    ...friendsWithoutConvo.map((f) => ({ key: f.user_id, node: <PersonRow profile={f} subtitle="Start a conversation" onClick={() => navigate(`/chat/${f.user_id}`)} /> })),
    ...(friendIds.size > 0 && otherConvos.length > 0 ? [{ key: "others", node: <p className="eyebrow pt-4 pb-1">Others</p> }] : []),
    ...otherConvos.map((c) => ({ key: c.partnerId, node: <ConversationRow conv={c} userId={user?.id} navigate={navigate} /> })),
  ];

  return (
    <div ref={scrollRef} className="min-h-full" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <PageBar title="Messages" onBack={() => navigate("/squad")} />

      <div className="px-4 pt-4 pb-6">
      <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} threshold={PULL_THRESHOLD} />

      {/* OPENING BEAT — who is waiting on you. Hidden, not absent, while the
          count loads so the search box never jumps. */}
      <header className="home-rise mb-4">
        <h2 className={cn("font-display font-black text-[27px] leading-[1.04] tracking-tight transition-opacity duration-300", isLoading && "opacity-0")}>
          {unread > 0 ? <><span className="text-gold glow-gold-text tabular-nums">{fmtInt(unread)}</span> unread.</> : "Quiet. Start one."}
        </h2>
      </header>

      {/* Search is a mode: while typing, results take the list's place. */}
      <div className="home-rise home-rise-1 mb-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" aria-hidden />
        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search users…" className="h-11 rounded-xl pl-9 pr-11 text-[13px]" />
        {searchQuery && (
          <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")} className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-muted-foreground/50 hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>

      {searching ? (
        <div className="home-rise">
          {searchResults && searchResults.length > 0 && (
            <div className="divide-y divide-border/35">
              {searchResults.map((u) => (
                <PersonRow key={u.user_id} profile={u} subtitle={`Lv ${fmtInt(u.level || 1)}`} onClick={() => { setSearchQuery(""); navigate(`/chat/${u.user_id}`); }} />
              ))}
            </div>
          )}
          {searchResults && searchResults.length === 0 && (
            <EmptyState size="compact" icon={SearchX} title="No users found" description={`Nothing matched "${searchQuery.trim()}". Try a different handle.`} />
          )}
        </div>
      ) : (
        <>
          {/* REQUESTS — the one quiet card: people asking for a yes. */}
          {pendingRequests && pendingRequests.length > 0 && (
            <section className="home-rise home-rise-2 mb-5">
              <h3 className="font-display text-base font-bold tracking-tight mb-2">Friend requests</h3>
              <div className="surface-card surface-card-quiet divide-y divide-border/35 px-1">
                {pendingRequests.map((req: any) => (
                  <ActionRow
                    key={req.id}
                    leading={<StatusAvatar src={req.profile?.avatar_url} name={req.profile?.username} tier={req.profile?.status_tier || "recruit"} size="sm" animated={false} />}
                    title={<TierUsername as="span" username={req.profile?.username} tier={req.profile?.status_tier || "recruit"} className="text-sm font-semibold" />}
                    subtitle="Wants to be friends"
                    onAccept={async () => {
                      const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", req.id);
                      if (error) { toast.error("Could not accept — try again."); return; }
                      invalidate("pending-friend-requests", "friends", "friend-requests", "conversations");
                    }}
                    onDecline={async () => {
                      const { error } = await supabase.from("friendships").update({ status: "declined" }).eq("id", req.id);
                      if (error) { toast.error("Could not decline — try again."); return; }
                      invalidate("pending-friend-requests", "friend-requests");
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* THE LIST — hairline rows, no card per thread. Entrance on the
              wrapper div so the row's own press still fires. */}
          {rows.length > 0 && (
            <div className="divide-y divide-border/35">
              {rows.map((row, i) => (
                <div key={row.key} className="animate-fade-in-up" style={{ animationDelay: `${210 + Math.min(i, 8) * 40}ms` }}>{row.node}</div>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="divide-y divide-border/35" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3 skeleton-block">
                  <div className="h-9 w-9 rounded-full bg-secondary" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-24 bg-secondary rounded" /><div className="h-2 w-40 bg-secondary rounded" /></div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && rows.length === 0 && (
            <div className="home-rise home-rise-2">
              <EmptyState icon={MessageCircle} title="No messages yet" description="Open someone's profile and tap Message to start a conversation." />
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
};

/** A person you could write to: a search hit, or a friend with no thread yet. */
const PersonRow = ({ profile, subtitle, onClick }: {
  profile: { username?: string | null; avatar_url?: string | null; status_tier?: string | null };
  subtitle: string;
  onClick: () => void;
}) => (
  <button type="button" onClick={onClick} className="w-full flex items-center gap-3 py-3 text-left">
    <StatusAvatar src={profile.avatar_url} name={profile.username} tier={profile.status_tier || "recruit"} size="sm" animated={false} />
    <div className="flex-1 min-w-0">
      <TierUsername as="p" username={profile.username} tier={profile.status_tier || "recruit"} className="text-sm font-semibold truncate" />
      <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
    </div>
    <MessageCircle size={14} className="text-muted-foreground/40 shrink-0" aria-hidden />
  </button>
);

const ConversationRow = ({ conv, userId, navigate }: { conv: any; userId?: string; navigate: any; isFriend?: boolean }) => {
  const unread = conv.unread > 0;
  return (
    <button type="button" onClick={() => navigate(`/chat/${conv.partnerId}`)} className="w-full flex items-center gap-3 py-3 text-left">
      <StatusAvatar src={conv.profile?.avatar_url} name={conv.profile?.username} tier={conv.profile?.status_tier || "recruit"} size="sm" animated={false} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <TierUsername as="p" username={conv.profile?.username} tier={conv.profile?.status_tier || "recruit"} className={cn("text-sm truncate", unread ? "font-bold" : "font-semibold")} />
          <span className={cn("text-[11px] tabular-nums shrink-0", unread ? "text-foreground/70" : "text-muted-foreground")}>{fmtRelative(conv.lastMessage.created_at)}</span>
        </div>
        <p className={cn("text-xs truncate mt-0.5", unread ? "text-foreground/85 font-medium" : "text-muted-foreground")}>
          {conv.lastMessage.sender_id === userId && "You: "}
          {conv.lastMessage.content}
        </p>
      </div>
      {unread && (
        <span className="shrink-0 h-2.5 w-2.5 rounded-full bg-ember shadow-[0_0_10px_hsl(var(--ember)/0.55)]">
          <span className="sr-only">{fmtInt(conv.unread)} unread</span>
        </span>
      )}
    </button>
  );
};

export default Messages;
