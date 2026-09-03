import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBlockActions } from "@/hooks/use-blocking";
import { Button } from "@/components/ui/button";
import StatusAvatar from "@/components/StatusAvatar";
import { EmptyState } from "@/components/ui/empty-state";

interface BlockedRow {
  blocked_id: string;
  username: string | null;
  avatar_url: string | null;
  status_tier: string | null;
}

const BlockedUsers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unblock } = useBlockActions();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["blocked-users", user?.id, "detailed"],
    enabled: !!user?.id,
    queryFn: async (): Promise<BlockedRow[]> => {
      const { data: blocks } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", user!.id);
      const ids = (blocks ?? []).map((b) => b.blocked_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier")
        .in("user_id", ids);
      return ids.map((id) => {
        const p = (profs ?? []).find((x) => x.user_id === id);
        return { blocked_id: id, username: p?.username ?? null, avatar_url: p?.avatar_url ?? null, status_tier: p?.status_tier ?? null };
      });
    },
  });

  return (
    <div className="min-h-full max-w-md mx-auto px-4 py-4 safe-top">
      <div className="flex items-center gap-2 mb-5">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} className="-ml-2 rounded-full" aria-label="Back">
          <ChevronLeft size={20} />
        </Button>
        <h1 className="font-display font-black text-lg tracking-tight">Blocked users</h1>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton-block h-16 rounded-2xl" />)}</div>
      ) : !rows?.length ? (
        <EmptyState icon={UserX} title="No one blocked" description="People you block won't be able to message or friend you, and you won't see each other's content." />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.blocked_id} className="surface-card p-3 flex items-center gap-3">
              <StatusAvatar src={r.avatar_url} name={r.username ?? "user"} tier={r.status_tier ?? "recruit"} size="sm" />
              <span className="flex-1 min-w-0 font-bold truncate">@{r.username ?? "user"}</span>
              <Button variant="gold-outline" size="sm" onClick={() => unblock(r.blocked_id, r.username ?? undefined)}>
                Unblock
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlockedUsers;
