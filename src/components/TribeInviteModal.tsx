import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avatarUrl } from "@/lib/img";
import { useAuth } from "@/contexts/AuthContext";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import { useCommitPop } from "@/hooks/use-commit-pop";
import { cn } from "@/lib/utils";

interface Props {
  tribeId: string;
  open: boolean;
  onClose: () => void;
}

interface Hit {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
}

const TribeInviteModal = ({ tribeId, open, onClose }: Props) => {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !tribeId) return;
    (async () => {
      const [m, i] = await Promise.all([
        supabase
          .from("tribe_members")
          .select("user_id")
          .eq("tribe_id", tribeId),
        supabase
          .from("tribe_invites")
          .select("invitee_id")
          .eq("tribe_id", tribeId)
          .eq("status", "pending"),
      ]);
      setMemberIds(new Set((m.data ?? []).map((r) => r.user_id)));
      setInvitedIds(new Set((i.data ?? []).map((r) => r.invitee_id)));
    })();
  }, [open, tribeId]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    // active-guard: clearTimeout can't recall an in-flight request, and a
    // slow stale response must not overwrite a newer query's results.
    let active = true;
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier")
        .ilike("username", `%${q}%`)
        .neq("user_id", profile?.user_id ?? "")
        .limit(20);
      if (!active) return;
      setHits(data ?? []);
      setSearching(false);
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [query, open, profile?.user_id]);

  const handleInvite = async (u: Hit) => {
    setSendingId(u.user_id);
    const { error } = await supabase.rpc("invite_to_tribe", {
      p_tribe_id: tribeId,
      p_invitee_id: u.user_id,
    });
    setSendingId(null);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    setInvitedIds((s) => new Set(s).add(u.user_id));
    toast.success(`Invite sent to @${u.username}`);
  };

  const hint = searching
    ? "Searching…"
    : query.trim().length < 2
    ? "Type at least 2 characters to search"
    : hits.length === 0
    ? `No users matching "${query}"`
    : null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Invite to tribe"
      title="Invite to tribe"
      height="tall"
      headerExtra={
        <div className="relative px-4 pb-2">
          <Search size={14} className="absolute left-7 top-[22px] -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username…"
            className="pl-9 h-11"
            autoFocus
          />
        </div>
      }
    >
      {hint ? (
        <p className="text-xs text-muted-foreground text-center py-8">{hint}</p>
      ) : (
        <div className="divide-y divide-border/35">
          {hits.map((u) => {
            const isMember = memberIds.has(u.user_id);
            const isInvited = invitedIds.has(u.user_id);
            return (
              <div key={u.user_id} className="flex items-center gap-3 py-2.5">
                <div className="h-9 w-9 rounded-full bg-secondary border border-border overflow-hidden shrink-0">
                  {u.avatar_url ? (
                    <img loading="lazy" decoding="async" src={avatarUrl(u.avatar_url, 48)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[11px] font-black text-muted-foreground">
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">@{u.username}</p>
                  {u.status_tier && (
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {u.status_tier.replace("_", " ")}
                    </p>
                  )}
                </div>
                {isMember ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                    <Users size={12} aria-hidden /> Member
                  </span>
                ) : (
                  <InviteAction invited={isInvited} sending={sendingId === u.user_id} onInvite={() => handleInvite(u)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
};

/** Invite button that becomes "Invited", popping only on the user's own tap
 *  (a row that was already invited when it appeared stays still). */
const InviteAction = ({ invited, sending, onInvite }: { invited: boolean; sending: boolean; onInvite: () => void }) => {
  const pop = useCommitPop(invited);
  if (invited) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold text-[hsl(var(--ember))]", pop && "commit-pop")}>
        <Check size={12} aria-hidden /> Invited
      </span>
    );
  }
  return (
    <Button onClick={onInvite} loading={sending} size="sm" variant="ember" className="min-h-11">
      <UserPlus size={12} /> Invite
    </Button>
  );
};

export default TribeInviteModal;
