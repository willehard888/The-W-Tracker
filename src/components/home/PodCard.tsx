import { useState } from "react";
import { Users, Check, Plus, Flame, Crown, UserPlus, X, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePod, usePodInvites, usePodActions } from "@/hooks/use-pod";
import { useFriends } from "@/hooks/use-friends";
import FriendPickerSheet from "@/components/social/FriendPickerSheet";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

const ERR: Record<string, string> = {
  already_in_pod: "You're already in a pod. Leave it first.",
  not_in_pod: "You're not in a pod.",
  not_friends: "You can only invite friends. Add them first.",
  already_member: "They're already in the pod.",
  pod_full: "That pod is full (5 max).",
  no_invite: "That invite is no longer available.",
  unauthorized: "Please sign in.",
};

const errKey = (e: any) =>
  e?.message?.match(/already_in_pod|not_in_pod|not_friends|already_member|pod_full|no_invite|unauthorized/)?.[0];

const PodCard = () => {
  const { user } = useAuth();
  const { data, isLoading } = usePod();
  const { data: invites } = usePodInvites();
  const { data: friends } = useFriends();
  const { createPod, inviteToPod, acceptInvite, declineInvite, leavePod } = usePodActions();

  const [mode, setMode] = useState<"idle" | "create">("idle");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);

  if (isLoading) {
    return <div className="h-24 rounded-3xl border border-border/40 bg-card/40 animate-pulse" />;
  }

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    hapticImpact("medium");
    try {
      await fn();
      hapticNotification("success");
      if (ok) toast.success(ok);
      setMode("idle"); setName("");
    } catch (e: any) {
      toast.error(ERR[errKey(e) ?? ""] ?? e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const card = "rounded-3xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card p-5 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)]";

  // ── Incoming pod invites (only relevant when not already in a pod) ───────
  const inviteList = !data ? (invites ?? []) : [];

  // ── No pod: invites + create ─────────────────────────────────────────────
  if (!data) {
    return (
      <div className={card}>
        <div className="flex items-center gap-2 mb-2">
          <Users size={12} className="text-gold" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85">Accountability pod</p>
        </div>
        <p className="text-[14px] font-bold leading-snug text-foreground">
          3–5 friends who see your daily check-in.
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          They notice the day you don't show up. That's the whole point.
        </p>

        {/* Incoming invites from friends */}
        {inviteList.length > 0 && (
          <div className="mt-3 space-y-2">
            {inviteList.map((iv) => (
              <div key={iv.pod_id} className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.05] p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-bold truncate">{iv.pod_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    @{iv.inviter_username} invited you · {iv.member_count}/5
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => run(() => acceptInvite(iv.pod_id), "Joined the pod! 🤝")}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-[11px] font-black text-primary-foreground disabled:opacity-60"
                >
                  <Check size={12} /> Join
                </button>
                <button
                  disabled={busy}
                  onClick={() => run(() => declineInvite(iv.pod_id))}
                  className="shrink-0 h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {mode === "idle" && (
          <button
            onClick={() => setMode("create")}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold/15 border border-gold/35 px-3 py-2.5 text-[12px] font-black text-gold active:scale-[0.98] transition-transform"
          >
            <Plus size={13} /> Create a pod
          </button>
        )}

        {mode === "create" && (
          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Pod name"
              className="flex-1 min-w-0 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 text-[13px] outline-none focus:border-gold/50"
            />
            <button
              disabled={busy}
              onClick={() => run(() => createPod(name), "Pod created — now invite friends.")}
              className="shrink-0 rounded-xl bg-gold px-4 py-2.5 text-[12px] font-black text-primary-foreground disabled:opacity-60"
            >
              {busy ? "…" : "Create"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Has pod: today status ────────────────────────────────────────────────
  const members = data.members ?? [];
  const inCount = members.filter((m) => m.checked_in_today).length;
  const total = members.length;
  const me = members.find((m) => m.user_id === user?.id);
  const youMissing = me && !me.checked_in_today;
  const allIn = total > 0 && inCount === total;
  const isOwner = data.pod.owner_id === user?.id;
  const memberIds = members.map((m) => m.user_id);

  const line = allIn
    ? "Full house — the pod is perfect today. 🔥"
    : youMissing
    ? inCount > 0
      ? "You're the gap. Everyone else showed up."
      : "Be the one who starts it today."
    : inCount === 0
    ? "Nobody's in yet. Lead the pod."
    : `${total - inCount} still out. Pull them up.`;

  return (
    <div className={card}>
      <div className="flex items-center gap-2 mb-3">
        <Users size={12} className="text-gold" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85 truncate">
          {data.pod.name}
        </p>
        {isOwner && <Crown size={11} className="text-gold/70 shrink-0" />}
        <span className="ml-auto text-[11px] font-black tabular-nums text-gold">
          {inCount}/{total} in
        </span>
      </div>

      {/* Member rings — checked-in = gold fill */}
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        {members.map((m) => (
          <div key={m.user_id} className="flex flex-col items-center gap-1 min-w-0">
            <div
              className={cn(
                "relative h-11 w-11 rounded-full flex items-center justify-center text-[13px] font-black border-2 overflow-hidden",
                m.checked_in_today
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border/50 bg-card/60 text-muted-foreground/70",
                m.user_id === user?.id && "ring-2 ring-gold/40 ring-offset-1 ring-offset-background",
              )}
            >
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (m.username?.charAt(0) || "?").toUpperCase()
              )}
              {m.checked_in_today && (
                <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-gold flex items-center justify-center border border-background">
                  <Check size={9} className="text-primary-foreground" strokeWidth={3.5} />
                </span>
              )}
            </div>
            <span className="text-[8.5px] text-muted-foreground truncate max-w-[44px]">
              {m.user_id === user?.id ? "You" : m.username}
            </span>
          </div>
        ))}
        {total < 5 && (
          <button onClick={() => setPicker(true)} className="flex flex-col items-center gap-1">
            <span className="h-11 w-11 rounded-full border-2 border-dashed border-gold/40 flex items-center justify-center text-gold">
              <UserPlus size={15} />
            </span>
            <span className="text-[8.5px] text-gold/80">Invite</span>
          </button>
        )}
      </div>

      <p className={cn("text-[12.5px] font-bold leading-snug", youMissing ? "text-[hsl(var(--streak-orange))]" : "text-foreground/85")}>
        {youMissing && <Flame size={12} className="inline mr-1 -mt-0.5 text-[hsl(var(--streak-orange))]" />}
        {line}
      </p>

      <div className="mt-3 flex items-center gap-2">
        {total < 5 && (
          <button
            onClick={() => setPicker(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gold/15 border border-gold/35 px-3 py-2 text-[11px] font-black text-gold active:scale-[0.98] transition-transform"
          >
            <UserPlus size={13} /> Invite friends
          </button>
        )}
        <button
          onClick={() => {
            if (window.confirm("Leave this pod?")) run(() => leavePod(), "You left the pod.");
          }}
          className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-[hsl(var(--streak-orange))] transition-colors"
        >
          <LogOut size={11} /> Leave
        </button>
      </div>

      <FriendPickerSheet
        open={picker}
        onOpenChange={setPicker}
        title="Invite a friend"
        subtitle="Only friends can join your pod. Pick who to invite."
        excludeIds={memberIds}
        busyId={busyInvite}
        onPick={async (f) => {
          setBusyInvite(f.user_id);
          hapticImpact("light");
          try {
            await inviteToPod(f.user_id);
            hapticNotification("success");
            toast.success(`Invited @${f.username} to the pod`);
          } catch (e: any) {
            toast.error(ERR[errKey(e) ?? ""] ?? e?.message ?? "Couldn't invite");
          } finally {
            setBusyInvite(null);
          }
        }}
      />
    </div>
  );
};

export default PodCard;
