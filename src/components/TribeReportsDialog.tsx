import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, Trash2, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface ReportRow {
  id: string;
  post_id: string;
  reason: string;
  reporter_id: string;
  created_at: string;
  resolved: boolean;
  reporter?: { username: string; avatar_url: string | null } | null;
  post?: {
    id: string;
    content: string | null;
    image_url: string | null;
    video_url: string | null;
    user_id: string;
    author?: { username: string; avatar_url: string | null } | null;
  } | null;
}

interface Props {
  tribeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export default function TribeReportsDialog({ tribeId, open, onOpenChange, onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);

    // Get all post ids in this tribe first (RLS allows owner to view reports for their posts)
    const { data: tribePosts } = await supabase
      .from("tribe_posts" as any)
      .select("id")
      .eq("tribe_id", tribeId);
    const postIds = ((tribePosts as any) ?? []).map((p: any) => p.id);
    if (!postIds.length) {
      setReports([]);
      setLoading(false);
      return;
    }

    const { data: rawReports } = await supabase
      .from("tribe_post_reports" as any)
      .select("*")
      .in("post_id", postIds)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(50);

    const list = ((rawReports as any) ?? []) as ReportRow[];
    if (list.length === 0) {
      setReports([]);
      setLoading(false);
      return;
    }

    const reporterIds = Array.from(new Set(list.map((r) => r.reporter_id)));
    const reportedPostIds = Array.from(new Set(list.map((r) => r.post_id)));

    const [postsRes, reportersRes] = await Promise.all([
      supabase.from("tribe_posts" as any)
        .select("id, content, image_url, video_url, user_id")
        .in("id", reportedPostIds),
      supabase.from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", reporterIds),
    ]);

    const posts = ((postsRes as any).data ?? []) as any[];
    const authorIds = Array.from(new Set(posts.map((p) => p.user_id)));
    const { data: authors } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url")
      .in("user_id", authorIds);
    const authorMap = new Map(((authors as any) ?? []).map((a: any) => [a.user_id, a]));
    const postMap = new Map(
      posts.map((p) => [p.id, { ...p, author: authorMap.get(p.user_id) ?? null }]),
    );
    const reporterMap = new Map(
      ((reportersRes as any).data ?? []).map((r: any) => [r.user_id, r]),
    );

    setReports(
      list.map((r) => ({
        ...r,
        post: (postMap.get(r.post_id) as any) ?? null,
        reporter: (reporterMap.get(r.reporter_id) as any) ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tribeId]);

  const dismissReport = async (r: ReportRow) => {
    setBusyId(r.id);
    // Owners can't UPDATE reports (admin-only RLS) — instead we just hide it locally
    // and clear the post.reported flag so the badge disappears on the post card.
    if (r.post?.id) {
      await supabase
        .from("tribe_posts" as any)
        .update({ reported: false })
        .eq("id", r.post.id);
    }
    setReports((prev) => prev.filter((x) => x.id !== r.id));
    setBusyId(null);
    toast.success("Report dismissed");
    onChanged?.();
  };

  const removePost = async (r: ReportRow) => {
    if (!r.post?.id) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setBusyId(r.id);
    const { error } = await supabase
      .from("tribe_posts" as any)
      .delete()
      .eq("id", r.post.id);
    if (error) {
      toast.error(error.message);
      setBusyId(null);
      return;
    }
    setReports((prev) => prev.filter((x) => x.post_id !== r.post_id));
    setBusyId(null);
    toast.success("Post removed");
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShieldAlert size={18} className="text-destructive" />
            Reports
          </DialogTitle>
          <DialogDescription>
            Posts your members flagged. Review and act fast.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gold" />
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No open reports. Tribe vibes are clean. ✨
          </div>
        )}

        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-destructive">
                    {r.reason}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Reported by @{r.reporter?.username ?? "user"} ·{" "}
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {r.post ? (
                <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-6 w-6 rounded-full bg-secondary overflow-hidden shrink-0">
                      {r.post.author?.avatar_url ? (
                        <img src={r.post.author.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <span className="text-xs font-semibold truncate">
                      @{r.post.author?.username ?? "user"}
                    </span>
                  </div>
                  {r.post.content && (
                    <p className="text-xs text-foreground/85 line-clamp-3 italic mb-1.5">
                      "{r.post.content}"
                    </p>
                  )}
                  {r.post.image_url && (
                    <img
                      src={r.post.image_url}
                      alt=""
                      className="rounded-md max-h-32 w-full object-cover border border-border/40"
                    />
                  )}
                  {r.post.video_url && (
                    <video
                      src={r.post.video_url}
                      className="rounded-md max-h-32 w-full object-cover border border-border/40"
                      muted
                      playsInline
                    />
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Post no longer exists.</p>
              )}

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={busyId === r.id}
                  onClick={() => dismissReport(r)}
                >
                  <Check size={14} /> Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  disabled={busyId === r.id || !r.post}
                  onClick={() => removePost(r)}
                >
                  {busyId === r.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Remove post
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
