import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avatarUrl } from "@/lib/img";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { ActionRow } from "@/components/ActionRow";
import EmptyState from "@/components/ui/empty-state";
import { UserCheck } from "lucide-react";
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
    <BottomSheet
      open={open}
      onClose={() => onOpenChange(false)}
      label="Pending requests"
      title="Pending requests"
      bodyClassName="px-1"
    >
      {loading ? (
        <div className="divide-y divide-border/35 px-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="py-2"><div className="h-10 rounded-lg skeleton-block bg-secondary/30" /></div>
          ))}
        </div>
      ) : pending.length === 0 ? (
        <EmptyState size="compact" icon={UserCheck} title="No pending requests" />
      ) : (
        <div className="divide-y divide-border/35">
          {pending.map((p) => (
            <ActionRow
              key={p.user_id}
              leading={
                <div className="h-10 w-10 rounded-full bg-secondary border border-border overflow-hidden">
                  {p.avatar_url ? (
                    <img loading="lazy" decoding="async" src={avatarUrl(p.avatar_url, 48)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[11px] font-black text-muted-foreground">
                      {p.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              }
              title={<TierUsername username={p.username} tier={p.status_tier || "recruit"} />}
              subtitle={p.status_tier ? <span className="capitalize">{p.status_tier.replace("_", " ")}</span> : undefined}
              acceptLabel="Approve"
              busy={actingId === p.user_id}
              onAccept={() => handleRespond(p.user_id, true)}
              onDecline={() => handleRespond(p.user_id, false)}
            />
          ))}
        </div>
      )}
    </BottomSheet>
  );
};

export default TribePendingRequestsDialog;
