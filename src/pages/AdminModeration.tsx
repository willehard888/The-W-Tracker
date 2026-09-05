import { fmtRelative } from "@/lib/format";
import { useEffect, useState } from "react";
import { DetailSkeleton } from "@/components/skeletons/PageSkeleton";
import { Navigate, useNavigate } from "react-router-dom";
import PageBar from "@/components/ui/page-bar";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import AppImage from "@/components/ui/app-image";

export default function AdminModeration() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

    // On reject, remove the reported content. Maps each reportable content_type
    // (feed post, tribe post, feed/tribe comment) to its table; direct_message
    // and profile reports are marked reviewed for out-of-band action (a DM can't
    // be unsent for both parties, and ejecting a user is a heavier manual step).
    if (decision === "rejected" && item.content_id) {
      const table: Record<string, string> = {
        feed_post: "feed_posts",
        tribe_post: "tribe_posts",
        comment: "feed_comments",
        tribe_comment: "tribe_post_comments",
      };
      const target = table[item.content_type];
      if (target) await supabase.from(target as never).delete().eq("id", item.content_id);
    }
    if (decision === "rejected" && item.content_type === "feed_post" && item.image_url) {
      const path = item.image_url.split("/feed-images/")[1];
      if (path) await supabase.storage.from("feed-images").remove([path]);
    }

    toast.success(decision === "approved" ? "Approved" : "Rejected");
    queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
  };

  return (
    <div className="min-h-full">
      <PageBar title="Moderation queue" onBack={() => navigate(-1)} />
      <div className="px-4 pt-4 pb-6">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          Low-confidence AI blocks waiting for human review.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <a
            href="/admin/legend-invites"
            className="eyebrow inline-flex items-center gap-1.5 text-gold hover:underline"
          >
            → Legend invites
          </a>
          <a
            href="/admin/metrics"
            className="eyebrow inline-flex items-center gap-1.5 text-gold hover:underline"
          >
            → Command Center
          </a>
        </div>
      </div>

      {isLoading && <DetailSkeleton />}

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
                <AppImage
                  src={item.image_url}
                  width={80}
                  alt=""
                  className="h-20 w-20 rounded-lg object-cover border border-border/50 shrink-0"
                />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="eyebrow text-muted-foreground">
                    {item.content_type}
                  </span>
                  {item.severity && (
                    <span className="eyebrow text-destructive">
                      {item.severity}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    conf {Math.round((item.ai_confidence ?? 0) * 100)}%
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {fmtRelative(item.created_at)}
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
    </div>
  );
}
