import { backOr } from "@/lib/nav";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { UserX } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBlockActions } from "@/hooks/use-blocking";
import { Button } from "@/components/ui/button";
import StatusAvatar from "@/components/StatusAvatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

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

  const { data: rows, isLoading, isError, refetch } = useQuery({
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
    <div className="min-h-full">
      <PageBar title="Blocked users" onBack={() => backOr(navigate, "/profile")} />

      <div className="px-4 pt-4 pb-6">
      <header className="home-rise">
        <h2 className="font-display font-black text-beat leading-[1.04] tracking-tight">
          {isLoading ? "\u00a0" : isError ? "Couldn't load your list." : !rows?.length ? "Nobody blocked." : `${rows.length} blocked.`}
        </h2>
        <p className="mt-1.5 text-dense text-muted-foreground leading-snug">
          Blocked people can't message or friend you, and neither of you sees the other's content.
        </p>
      </header>
      <div className="home-rise home-rise-1 mt-5">
      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton-block h-16 rounded-2xl" />)}</div>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !rows?.length ? (
        <EmptyState icon={UserX} title="No one blocked" description="Block from a profile's menu if someone crosses a line." />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.blocked_id} className="surface-card surface-card-quiet p-3 flex items-center gap-3">
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
      </div>
    </div>
  );
};

export default BlockedUsers;
