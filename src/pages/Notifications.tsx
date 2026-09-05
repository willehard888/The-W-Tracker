import { ActionRow } from "@/components/ActionRow";
import { fmtRelative } from "@/lib/format";
import { useState } from "react";
import { isSafeRoute } from "@/hooks/use-push-notifications";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Check, X, Swords, Users, Trophy, MessageSquare,
  Gift, Flame, Crown, CheckCheck, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
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
      const { error } = await supabase.rpc("respond_to_tribe_invite", { p_invite_id: inviteId, p_accept: accept });
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
    // Reuse the push path's allowlist — the same server data flows here, and
    // this keeps the whitelist the single navigation chokepoint.
    if (isSafeRoute(n.route)) navigate(n.route);
  };

  const actionCount = (friendRequests?.length ?? 0) + (tribeInvites?.length ?? 0) + (battleChallenges?.length ?? 0);
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="min-h-full">
      <PageBar
        title="Notifications"
        onBack={() => navigate(-1)}
        action={
          /* Friends management lives behind the bell now — the Squad-header
             UserPlus button this replaces was the page's only door. */
          <Button variant="secondary" size="icon" aria-label="Add friends" className="rounded-full" onClick={() => navigate("/friends")}>
            <UserPlus size={15} />
          </Button>
        }
      />

      <div className="px-4 pt-4 pb-6">
      {/* ── Needs your response ── */}
      {actionCount > 0 && (
        <div className="home-rise mb-6">
          <p className="eyebrow text-gold/85 mb-2 px-1">Needs your response · {actionCount}</p>
          <div className="surface-card divide-y divide-border/35 overflow-hidden">
            {(friendRequests ?? []).map((r) => (
              <ActionRow
                key={r.friendship_id}
                leading={
                  <button type="button" onClick={() => navigate(`/user/${r.user_id}`)} aria-label={`@${r.username}`}>
                    <StatusAvatar src={r.avatar_url} name={r.username} tier="recruit" size="sm" animated={false} />
                  </button>
                }
                title={`@${r.username}`}
                subtitle="wants to be friends"
                busy={busy === r.friendship_id}
                onAccept={() => guard(r.friendship_id, () => acceptRequest(r.friendship_id), "Friend added")}
                onDecline={() => guard(r.friendship_id, () => declineRequest(r.friendship_id))}
              />
            ))}

            {(tribeInvites ?? []).map((inv) => (
              <ActionRow
                key={inv.id}
                leading={
                  <span className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                    <Crown size={16} className="text-gold" aria-hidden />
                  </span>
                }
                title={inv.tribeName}
                subtitle={`Tribe invite from @${inv.inviter}`}
                acceptLabel="Join"
                busy={busy === inv.id}
                onAccept={() => respondTribeInvite(inv.id, true, inv.tribe_id, inv.tribeName)}
                onDecline={() => respondTribeInvite(inv.id, false, inv.tribe_id, inv.tribeName)}
              />
            ))}

            {(battleChallenges ?? []).map((b) => (
              <ActionRow
                key={b.id}
                leading={
                  <button
                    type="button"
                    onClick={() => b.challenger && navigate(`/user/${b.challenger.user_id}`)}
                    aria-label={`@${b.challenger?.username ?? "challenger"}`}
                  >
                    <StatusAvatar src={b.challenger?.avatar_url ?? null} name={b.challenger?.username ?? "?"} tier={b.challenger?.status_tier ?? "recruit"} size="sm" animated={false} />
                  </button>
                }
                title={
                  <>
                    <Swords size={13} className="inline -mt-0.5 mr-1 text-gold" aria-hidden />@{b.challenger?.username ?? "someone"}
                  </>
                }
                subtitle={`${b.battle_type} battle · ${b.duration_days} days`}
                busy={busy === b.id}
                onAccept={() => respondBattle(b.id, true)}
                onDecline={() => respondBattle(b.id, false)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Activity ── */}
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="eyebrow">Activity</p>
        {unread > 0 && (
          <Button variant="ghost" size="xs" className="text-gold" onClick={markAllRead}>
            <CheckCheck aria-hidden /> Mark all read
          </Button>
        )}
      </div>
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
                  "press w-full flex items-start gap-3 p-3 text-left rounded-xl border transition-colors ",
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
                  {n.body && <p className="text-[12px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {fmtRelative(n.created_at)}
                  </p>
                </div>
                {isUnread && <span className="h-2 w-2 rounded-full bg-[hsl(var(--ember))] shrink-0 mt-2" aria-label="Unread" />}
              </button>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};

export default Notifications;
