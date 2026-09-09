import { backOr } from "@/lib/nav";
import { Input } from "@/components/ui/input";
import { fmtInt, fmtRelative } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Search, Users, X, SearchX } from "lucide-react";
import StatusAvatar from "@/components/StatusAvatar";
import EmptyState from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import TierUsername from "@/components/TierUsername";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { useFriends, usePendingFriendCount } from "@/hooks/use-friends";
import { useUnreadMessageCount } from "@/hooks/use-messages";
import { useState, type ReactNode } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import PullRefreshIndicator from "@/components/PullRefreshIndicator";
import PageBar from "@/components/ui/page-bar";

type DirectMessage = Tables<"direct_messages">;
type ThreadProfile = Pick<Tables<"profiles">, "user_id" | "username" | "avatar_url" | "status_tier">;
/** One partner's thread, grouped client-side: there is no conversations table. */
interface Thread {
  partnerId: string;
  lastMessage: DirectMessage;
  unread: number;
  profile?: ThreadProfile;
}

const Messages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const pending = usePendingFriendCount().data ?? 0;
  const { scrollRef, pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd, PULL_THRESHOLD } = usePullRefresh([["friends-list"], ["conversations"], ["friend-request-count"], ["direct-messages"]]);

  // The friend list comes from the same RPC the Friends screen reads. This
  // screen used to roll its own two-step query against `friendships` +
  // `profiles`, and it came back empty while /friends showed the very same
  // person — so a friend you had never written to never appeared here.
  const { data: friends } = useFriends();

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

  const { data: conversations, isLoading, isError, refetch } = useQuery({
    queryKey: ["conversations", user?.id],
    staleTime: 30_000,       // conversations should be reasonably real-time
    gcTime:    5 * 60_000,
    queryFn: async () => {
      if (!user) return [];
      // Newest first, bounded: there is no conversations table, so the list is
      // grouped client-side from raw messages. Unbounded, this downloaded every
      // message the user had ever sent or received on every visit — and this
      // screen now has a door on the Squad tab. 400 covers far more than the
      // list can show; a real conversations view is the proper fix.
      const { data: msgs } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(400);
      if (!msgs || msgs.length === 0) return [];

      const convMap = new Map<string, { partnerId: string; lastMessage: DirectMessage; unread: number }>();
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

  // The exact count, not the sum over the fetched window — the same head query
  // the Squad door's badge reads, so the two can never disagree.
  const unread = useUnreadMessageCount().data ?? 0;
  const searching = searchQuery.trim().length >= 2;

  // One hairline list: friends' threads, friends you haven't written to, then
  // everyone else under the screen's single eyebrow.
  const rows: { key: string; node: ReactNode }[] = [
    ...friendConvos.map((c) => ({ key: c.partnerId, node: <ConversationRow conv={c} userId={user?.id} navigate={navigate} isFriend /> })),
    ...friendsWithoutConvo.map((f) => ({ key: f.user_id, node: <PersonRow profile={f} subtitle="Start a conversation" onClick={() => navigate(`/chat/${f.user_id}`)} /> })),
    ...(friendIds.size > 0 && otherConvos.length > 0 ? [{ key: "others", node: <p className="text-[11px] font-bold text-muted-foreground pt-4 pb-1">Others</p> }] : []),
    ...otherConvos.map((c) => ({ key: c.partnerId, node: <ConversationRow conv={c} userId={user?.id} navigate={navigate} /> })),
  ];

  return (
    <div ref={scrollRef} className="min-h-full" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <PageBar
        title="Messages"
        onBack={() => backOr(navigate, "/squad")}
        action={
          /* The other orphan route. The requests card that used to sit in this
             list lives on /friends, next to the rest of the friend graph. */
          <button
            type="button"
            aria-label={pending > 0 ? `Friends — ${pending} pending` : "Friends"}
            onClick={() => { hapticImpact("light"); navigate("/friends"); }}
            className="press relative h-11 w-11 rounded-xl inline-flex items-center justify-center text-muted-foreground/80 hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Users aria-hidden size={18} />
            {pending > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-[hsl(var(--ember))] text-white text-[10px] font-black flex items-center justify-center tabular-nums">
                {pending > 99 ? "99+" : pending}
              </span>
            )}
          </button>
        }
      />

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

          {!isLoading && isError && rows.length === 0 && (
            <div className="home-rise home-rise-2">
              <ErrorState title="Couldn't load messages" onRetry={refetch} />
            </div>
          )}
          {!isLoading && !isError && rows.length === 0 && (
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

const ConversationRow = ({ conv, userId, navigate }: { conv: Thread; userId?: string; navigate: NavigateFunction; isFriend?: boolean }) => {
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
