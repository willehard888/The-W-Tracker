import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, UserPlus, Check, Users } from "lucide-react";
import { toast } from "sonner";

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
          .from("tribe_members" as any)
          .select("user_id")
          .eq("tribe_id", tribeId),
        supabase
          .from("tribe_invites" as any)
          .select("invitee_id")
          .eq("tribe_id", tribeId)
          .eq("status", "pending"),
      ]);
      setMemberIds(new Set(((m as any).data ?? []).map((r: any) => r.user_id)));
      setInvitedIds(new Set(((i as any).data ?? []).map((r: any) => r.invitee_id)));
    })();
  }, [open, tribeId]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier")
        .ilike("username", `%${q}%`)
        .neq("user_id", profile?.user_id ?? "")
        .limit(20);
      setHits((data as any) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, open, profile?.user_id]);

  const handleInvite = async (u: Hit) => {
    setSendingId(u.user_id);
    const { error } = await supabase.rpc("invite_to_tribe" as any, {
      p_tribe_id: tribeId,
      p_invitee_id: u.user_id,
    });
    setSendingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInvitedIds((s) => new Set(s).add(u.user_id));
    toast.success(`Invite sent to @${u.username}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display font-black flex items-center gap-2">
            <UserPlus size={16} className="text-[hsl(18_95%_58%)]" />
            Invite to Tribe
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username…"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1 -mr-2 pr-2">
          {searching && (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {!searching && query.trim().length >= 2 && hits.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              No users matching "{query}"
            </p>
          )}

          {!searching && query.trim().length < 2 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Type at least 2 characters to search
            </p>
          )}

          {hits.map((u) => {
            const isMember = memberIds.has(u.user_id);
            const isInvited = invitedIds.has(u.user_id);
            const isSending = sendingId === u.user_id;
            return (
              <div
                key={u.user_id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-secondary border border-border overflow-hidden shrink-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.username} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] font-black text-muted-foreground">
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">@{u.username}</p>
                  {u.status_tier && (
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {u.status_tier.replace("_", " ")}
                    </p>
                  )}
                </div>
                {isMember ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground px-2 py-1 rounded-md bg-secondary/60">
                    <Users size={10} /> Member
                  </span>
                ) : isInvited ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[hsl(18_95%_58%)] px-2 py-1 rounded-md bg-[hsl(18_95%_58%)]/10 border border-[hsl(18_95%_58%)]/30">
                    <Check size={10} /> Invited
                  </span>
                ) : (
                  <Button
                    onClick={() => handleInvite(u)}
                    disabled={isSending}
                    size="sm"
                    variant="ember"
                    className="h-8 px-2.5 text-[10px]"
                  >
                    {isSending ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <UserPlus size={10} />
                    )}
                    Invite
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TribeInviteModal;
