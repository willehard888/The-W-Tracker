import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bell, Check, X, ChevronLeft, Swords, Users, Trophy, MessageSquare,
  Gift, Flame, Crown, CheckCheck, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import StatusAvatar from "@/components/StatusAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFriendRequests, useFriendActions } from "@/hooks/use-friends";
import { useNotifications, markNotificationRead, type AppNotification } from "@/hooks/use-notifications";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import { cn } from "@/lib/utils";

/** kind → icon for rows without an actor avatar. */
const KIND_ICONS: Record<string, typeof Bell> = {
  friend_request: Users,
  friend_accepted: Users,
  battle_challenge: Swords,
  battle_resolved: Swords,
  tribe_invite: Crown,
  tribe_join_request: Crown,
  tribe_battle_challenge: Swords,
  tribe_battle_resolved: Swords,
  tribe_milestone: Flame,
  kudos: Trophy,
  comment: MessageSquare,
  message: MessageSquare,
  referral_joined: Gift,
  referral_activated: Gift,
  referral_converted: Gift,
};

/**
 * The bell's home: everything that happened to you, in one place.
 *   1. "Needs your response" — friend requests, tribe invites and 1v1
 *      challenges with INLINE accept/decline (the same RPCs the dedicated
 *      pages use, so every surface stays in sync via shared query keys).
 *   2. "Activity" — the notifications ledger; tap marks read + deep-links.
 */
const Notifications = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: notifications, isLoading } = useNotifications();
  const { data: friendRequests } = useFriendRequests();
  const { acceptRequest, declineRequest } = useFriendActions();

  const { data: tribeInvites } = useQuery({
    queryKey: ["tribe-invites", profile?.user_id],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tribe_invites")
        .select("id, tribe_id, inviter_id, created_at")
        .eq("invitee_id", profile!.user_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      const rows = (data as { id: string; tribe_id: string; inviter_id: string; created_at: string }[]) ?? [];
      if (rows.length === 0) return [];
      const [tRes, uRes] = await Promise.all([
        supabase.from("tribes").select("id, name").in("id", rows.map((r) => r.tribe_id)),
        supabase.from("profiles").select("user_id, username").in("user_id", rows.map((r) => r.inviter_id)),
      ]);
      const tMap = new Map((tRes.data ?? []).map((t) => [t.id, t.name]));
      const uMap = new Map((uRes.data ?? []).map((u) => [u.user_id, u.username]));
      return rows.map((r) => ({ ...r, tribeName: tMap.get(r.tribe_id) ?? "a tribe", inviter: uMap.get(r.inviter_id) ?? "someone" }));
    },
  });

  const { data: battleChallenges } = useQuery({
    queryKey: ["battles", profile?.user_id, "incoming"],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("battles")
        .select("id, challenger_id, battle_type, duration_days, created_at")
        .eq("opponent_id", profile!.user_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      const rows = (data as { id: string; challenger_id: string; battle_type: string; duration_days: number; created_at: string }[]) ?? [];
      if (rows.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles").select("user_id, username, avatar_url, status_tier")
        .in("user_id", rows.map((r) => r.challenger_id));
      const pMap = new Map((profs ?? []).map((p) => [p.user_id, p]));
      return rows.map((r) => ({ ...r, challenger: pMap.get(r.challenger_id) ?? null }));
    },
  });

  const guard = async (id: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(id);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const respondTribeInvite = (inviteId: string, accept: boolean, tribeId: string, tribeName: string) =>
    guard(inviteId, async () => {
      const { error } = await supabase.rpc("respond_to_tribe_invite" as never, { p_invite_id: inviteId, p_accept: accept } as never);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["tribe-invites"] });
      queryClient.invalidateQueries({ queryKey: ["tribes-page"] });
      if (accept) navigate(`/tribes/${tribeId}`);
    }, accept ? `Joined ${tribeName}!` : "Invite declined");

  const respondBattle = (battleId: string, accept: boolean) =>
    guard(battleId, async () => {
      const { error } = await supabase.rpc("respond_to_battle", { battle_id: battleId, accept });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    }, accept ? "Battle accepted! ⚔️" : "Battle declined");

  const markAllRead = async () => {
    const { error } = await supabase.rpc("mark_notifications_read", {});
    if (error) toast.error(friendlyError(error));
    else queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const openNotification = (n: AppNotification) => {
    if (!n.read_at) {
      queryClient.setQueryData<AppNotification[]>(["notifications", profile?.user_id], (prev) =>
        prev?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
      );
      // Invalidate AFTER the PATCH lands — the globally-mounted unread badge
      // refetches on invalidate, and an immediate refetch raced the write and
      // kept showing the pre-read count.
      void markNotificationRead(n.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications", profile?.user_id, "unread-count"] });
      });
    }
    if (n.route) navigate(n.route.split("?")[0].startsWith("/") ? n.route : "/");
  };

  const actionCount = (friendRequests?.length ?? 0) + (tribeInvites?.length ?? 0) + (battleChallenges?.length ?? 0);
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="min-h-full pb-6 px-4 pt-3">
      <div className="page-header-premium px-0 pt-0 pb-2 flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft size={20} />
        </Button>
        <h1 className="font-display text-base font-black tracking-tight">Notifications</h1>
        <div className="ml-auto flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-gold active:opacity-70"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          {/* Friends management lives behind the bell now — the Squad-header
              UserPlus button this replaces was the page's only door. */}
          <button
            onClick={() => navigate("/friends")}
            aria-label="Add friends"
            className="h-9 w-9 rounded-full bg-secondary/70 border border-border flex items-center justify-center text-foreground/90 active:scale-95 transition-transform"
          >
            <UserPlus size={15} />
          </button>
        </div>
      </div>

      {/* ── Needs your response ── */}
      {actionCount > 0 && (
        <div className="animate-reveal mb-6">
          <p className="eyebrow text-gold/85 mb-2 px-1">Needs your response · {actionCount}</p>
          <div className="space-y-1.5">
            {(friendRequests ?? []).map((r) => (
              <div key={r.friendship_id} className="flex items-center gap-3 rounded-xl border border-gold/25 bg-gold/[0.05] p-2.5">
                <button onClick={() => navigate(`/user/${r.user_id}`)} className="shrink-0">
                  <StatusAvatar src={r.avatar_url} name={r.username} tier="recruit" size="sm" animated={false} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">@{r.username}</p>
                  <p className="text-[10px] text-muted-foreground">wants to be friends</p>
                </div>
                <Button size="sm" variant="ember" disabled={busy === r.friendship_id}
                  onClick={() => guard(r.friendship_id, () => acceptRequest(r.friendship_id), "Friend added")}>
                  <Check size={13} /> Accept
                </Button>
                <button
                  disabled={busy === r.friendship_id}
                  aria-label="Decline request"
                  onClick={() => guard(r.friendship_id, () => declineRequest(r.friendship_id))}
                  className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground shrink-0"
                >
                  <X size={15} />
                </button>
              </div>
            ))}

            {(tribeInvites ?? []).map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-gold/25 bg-gold/[0.05] p-2.5">
                <span className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                  <Crown size={16} className="text-gold" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">{inv.tribeName}</p>
                  <p className="text-[10px] text-muted-foreground">Tribe invite from @{inv.inviter}</p>
                </div>
                <Button size="sm" variant="ember" disabled={busy === inv.id}
                  onClick={() => respondTribeInvite(inv.id, true, inv.tribe_id, inv.tribeName)}>
                  <Check size={13} /> Join
                </Button>
                <button
                  disabled={busy === inv.id}
                  aria-label="Decline invite"
                  onClick={() => respondTribeInvite(inv.id, false, inv.tribe_id, inv.tribeName)}
                  className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground shrink-0"
                >
                  <X size={15} />
                </button>
              </div>
            ))}

            {(battleChallenges ?? []).map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-gold/25 bg-gold/[0.05] p-2.5">
                <button onClick={() => b.challenger && navigate(`/user/${b.challenger.user_id}`)} className="shrink-0">
                  <StatusAvatar src={b.challenger?.avatar_url ?? null} name={b.challenger?.username ?? "?"} tier={b.challenger?.status_tier ?? "recruit"} size="sm" animated={false} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">⚔️ @{b.challenger?.username ?? "someone"}</p>
                  <p className="text-[10px] text-muted-foreground">{b.battle_type} battle · {b.duration_days} days</p>
                </div>
                <Button size="sm" variant="ember" disabled={busy === b.id} onClick={() => respondBattle(b.id, true)}>
                  <Check size={13} /> Accept
                </Button>
                <button
                  disabled={busy === b.id}
                  aria-label="Decline battle"
                  onClick={() => respondBattle(b.id, false)}
                  className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground shrink-0"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Activity ── */}
      <p className="eyebrow mb-2 px-1">Activity</p>
      {isLoading ? (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-card/60 skeleton-block" />)}
        </div>
      ) : (notifications?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Bell}
          title="Quiet for now"
          description="Friend requests, invites, kudos and battle news land here — go earn some noise."
        />
      ) : (
        <div className="space-y-1.5">
          {notifications!.map((n) => {
            const Icon = KIND_ICONS[n.kind] ?? Bell;
            const isUnread = !n.read_at;
            return (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 text-left rounded-xl border transition-colors active:scale-[0.99]",
                  isUnread ? "border-gold/25 bg-gold/[0.05]" : "border-border/50 bg-card/40",
                )}
              >
                <span className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                  isUnread ? "bg-gold/12 border border-gold/30 text-gold" : "bg-secondary text-muted-foreground",
                )}>
                  <Icon size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[13px] leading-snug", isUnread ? "font-bold text-foreground" : "font-semibold text-foreground/85")}>
                    {n.title}
                  </p>
                  {n.body && <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {isUnread && <span className="h-2 w-2 rounded-full bg-[hsl(var(--ember))] shrink-0 mt-2" aria-label="Unread" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
