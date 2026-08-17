import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

export default function AdminModeration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let alive = true;
    void supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(
        ({ data }) => { if (alive) setIsAdmin(!!data); },
        () => { if (alive) setIsAdmin(false); },
      );
    return () => { alive = false; };
  }, [user]);

  const { data: queue, isLoading } = useQuery({
    queryKey: ["moderation-queue"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_queue")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Realtime updates
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel(uniqueChannelName("moderation-queue-changes"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moderation_queue" },
        () => queryClient.invalidateQueries({ queryKey: ["moderation-queue"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, queryClient]);

  if (isAdmin === null) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const review = async (
    item: any,
    decision: "approved" | "rejected",
  ) => {
    if (!user) return;
    const { error } = await supabase
      .from("moderation_queue")
      .update({
        status: decision,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (error) {
      toast.error("Could not update review");
      return;
    }

    if (decision === "rejected" && item.content_type === "feed_post" && item.content_id) {
      await supabase.from("feed_posts").delete().eq("id", item.content_id);
    }
    if (decision === "rejected" && item.content_type === "feed_post" && item.image_url) {
      const path = item.image_url.split("/feed-images/")[1];
      if (path) await supabase.storage.from("feed-images").remove([path]);
    }

    toast.success(decision === "approved" ? "Approved" : "Rejected");
    queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
  };

  return (
    <div className="min-h-full pb-8 px-4 pt-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-gold" />
          <h1 className="font-display text-2xl font-bold tracking-tight">Moderation Queue</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Low-confidence AI blocks waiting for human review.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <a
            href="/admin/legend-invites"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold hover:underline"
          >
            → Legend invites
          </a>
          <a
            href="/admin/metrics"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold hover:underline"
          >
            → Command Center
          </a>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      )}

      {!isLoading && queue && queue.length === 0 && (
        <div className="text-center py-16">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-gold/40" />
          <p className="text-sm font-semibold text-muted-foreground">Queue clear 🎉</p>
        </div>
      )}

      <div className="space-y-3">
        {queue?.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-20 w-20 rounded-lg object-cover border border-border/50 shrink-0"
                />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {item.content_type}
                  </span>
                  {item.severity && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-destructive">
                      {item.severity}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    conf {Math.round((item.ai_confidence ?? 0) * 100)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm font-semibold mt-1">{item.ai_reason ?? "No reason"}</p>
                {item.ai_categories?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.ai_categories.join(" · ")}
                  </p>
                )}
                {item.text_content && (
                  <p className="mt-2 text-xs text-foreground/80 line-clamp-3 italic">
                    "{item.text_content}"
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => review(item, "approved")}
                className="flex-1"
              >
                <CheckCircle2 size={14} />
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => review(item, "rejected")}
                className="flex-1"
              >
                <XCircle size={14} />
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
