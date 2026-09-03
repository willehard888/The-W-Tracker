import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avatarUrl } from "@/lib/img";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import TierUsername from "@/components/TierUsername";
import { friendlyError } from "@/lib/error-copy";

interface PendingMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  joined_at: string;
}

interface Props {
  tribeId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}

const TribePendingRequestsDialog = ({ tribeId, open, onOpenChange, onChanged }: Props) => {
  const [pending, setPending] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("tribe_members")
      .select("user_id, joined_at")
      .eq("tribe_id", tribeId)
      .eq("status", "pending")
      .order("joined_at", { ascending: false });
    const userIds = (rows ?? []).map((r) => r.user_id);
    if (userIds.length === 0) {
      setPending([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, status_tier")
      .in("user_id", userIds);
    const profMap = new Map((profs ?? []).map((p) => [p.user_id, p]));
    setPending(
      (rows ?? [])
        .map((r) => {
          const p = profMap.get(r.user_id);
          return p ? { ...p, joined_at: r.joined_at } : null;
        })
        .filter(Boolean) as PendingMember[],
    );
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tribeId]);

  const handleRespond = async (userId: string, accept: boolean) => {
    setActingId(userId);
    const { error } = await supabase.rpc("approve_tribe_member", {
      p_tribe_id: tribeId,
      p_user_id: userId,
      p_accept: accept,
    });
    setActingId(null);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(accept ? "Member approved" : "Request declined");
    setPending((arr) => arr.filter((p) => p.user_id !== userId));
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck size={16} className="text-[hsl(var(--ember))]" />
            Pending requests
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : pending.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No pending requests.
          </p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {pending.map((p) => (
              <div
                key={p.user_id}
                className="rounded-xl p-3 border border-border bg-card/60 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-full bg-secondary border border-border overflow-hidden shrink-0">
                  {p.avatar_url ? (
                    <img loading="lazy" decoding="async" src={avatarUrl(p.avatar_url, 48)} alt={p.username} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[11px] font-black text-muted-foreground">
                      {p.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <TierUsername
                    as="p"
                    username={p.username}
                    tier={p.status_tier || "recruit"}
                    className="text-sm font-black truncate"
                  />
                  {p.status_tier && (
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {p.status_tier.replace("_", " ")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleRespond(p.user_id, true)}
                    disabled={actingId === p.user_id}
                    className="h-8 px-2 bg-gradient-to-r from-[hsl(var(--ember))] to-gold text-background font-black"
                  >
                    <Check size={12} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRespond(p.user_id, false)}
                    disabled={actingId === p.user_id}
                    className="h-8 px-2"
                  >
                    <X size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TribePendingRequestsDialog;
