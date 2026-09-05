import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, UserPlus, UserCheck, Clock, Check, X,
  Flame, MessageCircle, Users, UserMinus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useFriends, useFriendRequests, useSentFriendRequests, useFriendActions,
} from "@/hooks/use-friends";
import { useSuggestedFriends } from "@/hooks/use-suggested-friends";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

interface SearchRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  level: number | null;
}

const Avatar = ({ url, name, size = 44 }: { url: string | null; name: string; size?: number }) => (
  <div
    className="rounded-full overflow-hidden bg-gradient-to-br from-gold/40 to-card flex items-center justify-center font-black text-gold shrink-0"
    style={{ height: size, width: size, fontSize: size * 0.32 }}
  >
    {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (name?.charAt(0) || "?").toUpperCase()}
  </div>
);

const Friends = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: friends, isLoading: friendsLoading } = useFriends();
  const { data: requests } = useFriendRequests();
  const { data: sent } = useSentFriendRequests();
  const { sendRequest, acceptRequest, declineRequest, removeFriend } = useFriendActions();
  const { data: suggestions } = useSuggestedFriends();

  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const friendIds = useMemo(() => new Set((friends ?? []).map((f) => f.user_id)), [friends]);
  const sentIds = useMemo(() => new Set((sent ?? []).map((f) => f.user_id)), [sent]);
  const incomingById = useMemo(
    () => new Map((requests ?? []).map((r) => [r.user_id, r.friendship_id])),
    [requests],
  );

  const { data: results, isFetching: searching } = useQuery<SearchRow[]>({
    queryKey: ["friend-search", q.trim()],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier, level")
        .neq("user_id", user?.id ?? "")
        .ilike("username", `%${q.trim()}%`)
        .limit(12);
      return (data as SearchRow[]) ?? [];
    },
  });

  const guard = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(key);
    hapticImpact("light");
    try {
      await fn();
      if (ok) { hapticNotification("success"); toast.success(ok); }
    } catch (e: any) {
      const msg = e?.message?.includes("duplicate") ? "Request already exists" : (e?.message ?? "Something went wrong");
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  const searching2 = q.trim().length >= 2;

  return (
    <div className="min-h-full">
      <PageBar
        title="Friends"
        onBack={() => navigate(-1)}
        action={
          (friends?.length ?? 0) > 0 ? (
            <span className="min-w-10 text-center text-[12px] font-bold text-muted-foreground tabular-nums">{friends!.length}</span>
          ) : undefined
        }
      />

      <div className="px-4 pt-4 pb-6 space-y-5">
        {/* Search / add */}
        <div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Add a friend by username"
              className="w-full rounded-xl border border-border/50 bg-background/40 pl-9 pr-9 py-2.5 text-[13px] outline-none focus:border-gold/50 transition-colors"
            />
          </div>

          {searching2 && (
            <div className="mt-2 space-y-1.5">
              {searching && !results ? (
                <div className="h-14 rounded-xl bg-card/60 skeleton-block" />
              ) : (results ?? []).length === 0 ? (
                <p className="text-[12px] text-muted-foreground px-1 py-3 text-center">No users match “{q.trim()}”.</p>
              ) : (
                results!.map((r) => {
                  const isFriend = friendIds.has(r.user_id);
                  const isSent = sentIds.has(r.user_id);
                  const incomingFid = incomingById.get(r.user_id);
                  return (
                    <div key={r.user_id} className="flex items-center gap-3 surface-card p-2.5">
                      <button onClick={() => navigate(`/user/${r.user_id}`)} className="shrink-0">
                        <Avatar url={r.avatar_url} name={r.username} size={40} />
                      </button>
                      <button onClick={() => navigate(`/user/${r.user_id}`)} className="flex-1 min-w-0 text-left">
                        <p className="text-[13px] font-bold truncate">@{r.username}</p>
                        <p className="text-[11px] text-muted-foreground">Lv {r.level ?? 1}</p>
                      </button>
                      {isFriend ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-gold px-2"><UserCheck size={13} /> Friends</span>
                      ) : incomingFid ? (
                        <Button size="sm" variant="ember" disabled={busy === r.user_id}
                          onClick={() => guard(r.user_id, () => acceptRequest(incomingFid), "Friend added! 🎉")}>
                          <Check size={13} /> Accept
                        </Button>
                      ) : isSent ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-muted-foreground px-2"><Clock size={12} /> Pending</span>
                      ) : (
                        <Button size="sm" variant="ember" disabled={busy === r.user_id}
                          onClick={() => guard(r.user_id, () => sendRequest(r.user_id), "Friend request sent 🤝")}>
                          <UserPlus size={13} /> Add
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* People you may know — members of your tribes you're not connected to */}
        {!searching2 && (suggestions?.length ?? 0) > 0 && (
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold/85 mb-2 px-1">
              People you may know
            </p>
            <div className="space-y-1.5">
              {suggestions!.map((s) => {
                const isSent = sentIds.has(s.user_id);
                const incomingFid = incomingById.get(s.user_id);
                return (
                  <div key={s.user_id} className="flex items-center gap-3 surface-card p-2.5">
                    <button onClick={() => navigate(`/user/${s.user_id}`)} className="shrink-0">
                      <Avatar url={s.avatar_url} name={s.username} size={40} />
                    </button>
                    <button onClick={() => navigate(`/user/${s.user_id}`)} className="flex-1 min-w-0 text-left">
                      <p className="text-[13px] font-bold truncate">@{s.username}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.mutual_tribes} shared tribe{s.mutual_tribes === 1 ? "" : "s"} · Lv {s.level ?? 1}
                      </p>
                    </button>
                    {incomingFid ? (
                      <Button size="sm" variant="ember" disabled={busy === s.user_id}
                        onClick={() => guard(s.user_id, () => acceptRequest(incomingFid), "Friend added! 🎉")}>
                        <Check size={13} /> Accept
                      </Button>
                    ) : isSent ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-muted-foreground px-2"><Clock size={12} /> Pending</span>
                    ) : (
                      <Button size="sm" variant="ember" disabled={busy === s.user_id}
                        onClick={() => guard(s.user_id, () => sendRequest(s.user_id), "Friend request sent 🤝")}>
                        <UserPlus size={13} /> Add
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Incoming requests */}
        {(requests?.length ?? 0) > 0 && (
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold/85 mb-2 px-1">
              Friend requests · {requests!.length}
            </p>
            <div className="space-y-1.5">
              {requests!.map((r) => (
                <div key={r.friendship_id} className="flex items-center gap-3 rounded-xl border border-gold/25 bg-gold/[0.05] p-2.5">
                  <button onClick={() => navigate(`/user/${r.user_id}`)} className="shrink-0">
                    <Avatar url={r.avatar_url} name={r.username} size={40} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate">@{r.username}</p>
                    <p className="text-[11px] text-muted-foreground">wants to be friends</p>
                  </div>
                  <Button size="sm" variant="ember" disabled={busy === r.friendship_id}
                    onClick={() => guard(r.friendship_id, () => acceptRequest(r.friendship_id), "Friend added! 🎉")}>
                    <Check size={13} /> Accept
                  </Button>
                  <button
                    disabled={busy === r.friendship_id}
                    aria-label="Decline request"
                    onClick={() => guard(r.friendship_id, () => declineRequest(r.friendship_id))}
                    className="h-8 w-8 min-h-11 min-w-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground shrink-0"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your friends */}
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground/70 mb-2 px-1">
            Your friends
          </p>
          {friendsLoading ? (
            <div className="space-y-1.5">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-card/60 skeleton-block" />)}
            </div>
          ) : (friends?.length ?? 0) === 0 ? (
            <div className="surface-card p-6 text-center">
              <Users size={26} className="text-gold/60 mx-auto mb-2" />
              <p className="text-[13px] font-bold text-foreground">No friends yet</p>
              <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
                Search a username above to send your first request. Friends power your battles and feed.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {friends!.map((f) => (
                <div key={f.user_id} className="flex items-center gap-3 surface-card p-2.5">
                  <button onClick={() => navigate(`/user/${f.user_id}`)} className="shrink-0">
                    <Avatar url={f.avatar_url} name={f.username} />
                  </button>
                  <button onClick={() => navigate(`/user/${f.user_id}`)} className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-bold truncate">@{f.username}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>Lv {f.level ?? 1}</span>
                      {(f.streak ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[hsl(var(--streak-orange))]">
                          <Flame size={11} /> {f.streak}
                        </span>
                      )}
                    </p>
                  </button>
                  <button
                    onClick={() => navigate(`/chat/${f.user_id}`)}
                    className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-gold shrink-0"
                    aria-label="Message"
                  >
                    <MessageCircle size={16} />
                  </button>
                  <button
                    disabled={busy === f.user_id}
                    onClick={() => guard(f.user_id, () => removeFriend(f.user_id), "Friend removed")}
                    className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground/70 shrink-0"
                    aria-label="Remove friend"
                  >
                    <UserMinus size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Friends;
