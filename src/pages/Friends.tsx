import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, UserPlus, UserCheck, Clock, Check, X, MessageCircle, Users, UserMinus,
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
import EmptyState from "@/components/ui/empty-state";
import ErrorState from "@/components/ui/error-state";
import StatusAvatar from "@/components/StatusAvatar";
import { cn } from "@/lib/utils";
import { fmtInt } from "@/lib/format";
import { backOr } from "@/lib/nav";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

interface SearchRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  level: number | null;
}

/** One person, one hairline row: avatar · name + line · trailing slot. */
const PersonRow = ({
  person, sub, onOpen, children,
}: {
  person: { avatar_url: string | null; username: string; status_tier: string | null };
  sub: string;
  onOpen: () => void;
  children: React.ReactNode;
}) => (
  <li className="flex items-center gap-3 py-2.5">
    <button type="button" onClick={onOpen} className="press shrink-0" aria-label={`@${person.username}`}>
      <StatusAvatar src={person.avatar_url} name={person.username} tier={person.status_tier || "recruit"} size="sm" animated={false} />
    </button>
    <button type="button" onClick={onOpen} className="press flex-1 min-w-0 min-h-11 text-left">
      <span className="block text-[14px] font-semibold leading-tight truncate">@{person.username}</span>
      <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{sub}</span>
    </button>
    {children}
  </li>
);

/**
 * /friends — your circle. The beat carries the count, the incoming requests
 * are the one block with weight, everyone else is a hairline row.
 */
const Friends = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: friends, isLoading: friendsLoading, isError: friendsFailed, refetch } = useFriends();
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

  const isSearching = q.trim().length >= 2;
  const count = friends?.length ?? 0;
  const open = (id: string) => () => navigate(`/user/${id}`);

  /** Trailing slot for someone who is not (yet) in the circle. */
  const relation = (id: string) => {
    const incomingFid = incomingById.get(id);
    if (friendIds.has(id)) {
      return <span className="inline-flex items-center gap-1 text-[12px] font-bold text-muted-foreground px-2"><UserCheck size={13} aria-hidden /> In circle</span>;
    }
    if (incomingFid) {
      return (
        <Button size="sm" variant="ember" className={cn("min-h-11", busy === id && "commit-pop")} disabled={busy === id}
          onClick={() => guard(id, () => acceptRequest(incomingFid), "Friend added.")}>
          <Check size={13} aria-hidden /> Accept
        </Button>
      );
    }
    if (sentIds.has(id)) {
      return <span className="inline-flex items-center gap-1 text-[12px] font-bold text-muted-foreground px-2"><Clock size={12} aria-hidden /> Pending</span>;
    }
    return (
      <Button size="sm" variant="ember" className="min-h-11" disabled={busy === id}
        onClick={() => guard(id, () => sendRequest(id), "Request sent.")}>
        <UserPlus size={13} aria-hidden /> Add
      </Button>
    );
  };

  return (
    <div className="min-h-full">
      <PageBar title="Friends" onBack={() => backOr(navigate, "/squad")} />

      <div className="px-4 pt-4 pb-6">
        <header className="home-rise">
          <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
            {friendsLoading || friendsFailed ? (
              "Your circle."
            ) : count === 0 ? (
              "Nobody in your circle yet."
            ) : (
              <><span className="text-gold glow-gold-text tabular-nums">{fmtInt(count)}</span> in your circle.</>
            )}
          </h2>
        </header>

        {/* Search / add */}
        <div className="home-rise home-rise-1 mt-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Add a friend by username"
              className="h-11 rounded-xl pl-9 pr-9 text-[13px]"
            />
          </div>

          {isSearching && (
            searching && !results ? (
              <div className="mt-2 h-14 rounded-xl bg-card/60 skeleton-block" />
            ) : (results ?? []).length === 0 ? (
              <p className="text-[12px] text-muted-foreground px-1 py-3 text-center">No one matches “{q.trim()}”.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border/35 border-t border-border/35">
                {results!.map((r) => (
                  <PersonRow key={r.user_id} person={r} sub={`Lv ${r.level ?? 1}`} onOpen={open(r.user_id)}>
                    {relation(r.user_id)}
                  </PersonRow>
                ))}
              </ul>
            )
          )}
        </div>

        {/* Incoming requests: the one block with weight. */}
        {(requests?.length ?? 0) > 0 && (
          <div className="home-rise home-rise-2 mt-5 surface-card p-3">
            <p className="text-[11px] font-bold text-muted-foreground px-1 mb-1">
              {requests!.length === 1 ? "One request" : `${requests!.length} requests`}
            </p>
            <ul className="divide-y divide-border/35">
              {requests!.map((r) => (
                <PersonRow key={r.friendship_id} person={r} sub="wants in your circle" onOpen={open(r.user_id)}>
                  <Button size="sm" variant="ember" className={cn("min-h-11", busy === r.friendship_id && "commit-pop")} disabled={busy === r.friendship_id}
                    onClick={() => guard(r.friendship_id, () => acceptRequest(r.friendship_id), "Friend added.")}>
                    <Check size={13} aria-hidden /> Accept
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="rounded-full text-muted-foreground shrink-0" aria-label="Decline request"
                    disabled={busy === r.friendship_id}
                    onClick={() => guard(r.friendship_id, () => declineRequest(r.friendship_id))}>
                    <X size={15} aria-hidden />
                  </Button>
                </PersonRow>
              ))}
            </ul>
          </div>
        )}

        {/* The circle */}
        <div className="home-rise home-rise-3 mt-5">
          {friendsLoading ? (
            <div className="space-y-1">
              {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-card/40 skeleton-block" />)}
            </div>
          ) : friendsFailed ? (
            <ErrorState title="Couldn't load your circle" onRetry={refetch} />
          ) : count === 0 ? (
            <EmptyState
              icon={Users}
              title="Your circle starts with one"
              description="Search a username above, or pick someone worth chasing off the leaderboard."
              action={
                <Button variant="gold-outline" size="sm" className="min-h-11" onClick={() => navigate("/leaderboard")}>
                  Open the leaderboard
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/35 border-t border-border/35">
              {friends!.map((f) => (
                <PersonRow
                  key={f.user_id}
                  person={f}
                  sub={(f.streak ?? 0) > 0 ? `Lv ${f.level ?? 1} · ${f.streak}-day streak` : `Lv ${f.level ?? 1}`}
                  onOpen={open(f.user_id)}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/chat/${f.user_id}`)}
                    className="relative before:absolute before:-inset-1 before:content-[''] h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-foreground shrink-0"
                    aria-label={`Message @${f.username}`}
                  >
                    <MessageCircle size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={busy === f.user_id}
                    onClick={() => guard(f.user_id, () => removeFriend(f.user_id), "Removed from your circle.")}
                    className="relative before:absolute before:-inset-1 before:content-[''] h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground/70 shrink-0"
                    aria-label={`Remove @${f.username}`}
                  >
                    <UserMinus size={15} aria-hidden />
                  </button>
                </PersonRow>
              ))}
            </ul>
          )}
        </div>

        {/* People you may know: members of your tribes you're not connected to. */}
        {!isSearching && (suggestions?.length ?? 0) > 0 && (
          <div className="home-rise home-rise-4 mt-6">
            <p className="text-[11px] font-bold text-muted-foreground mb-1">People you may know</p>
            <ul className="divide-y divide-border/35 border-t border-border/35">
              {suggestions!.map((s) => (
                <PersonRow
                  key={s.user_id}
                  person={s}
                  sub={`${s.mutual_tribes} shared tribe${s.mutual_tribes === 1 ? "" : "s"} · Lv ${s.level ?? 1}`}
                  onOpen={open(s.user_id)}
                >
                  {relation(s.user_id)}
                </PersonRow>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Friends;
