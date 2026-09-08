import { fmtRelative } from "@/lib/format";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avatarUrl } from "@/lib/img";
import AppImage from "@/components/ui/app-image";
import { useSignedMediaUrl } from "@/lib/signed-url";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import EmptyState from "@/components/ui/empty-state";
import { ShieldCheck, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";

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

/** Reported videos live in the private feed-images bucket — sign to preview. */
const ReportVideo = ({ src }: { src: string }) => {
  const signed = useSignedMediaUrl(src);
  if (!signed) return null;
  return (
    <video
      src={signed}
      className="rounded-md max-h-32 w-full object-cover border border-border/40"
      muted
      playsInline
    />
  );
};

export default function TribeReportsDialog({ tribeId, open, onOpenChange, onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  // The report whose post is pending a delete confirm. AlertDialog renders at
  // --z-confirm (140), above this sheet (120), so the real dialog can be used.
  const [confirmRemove, setConfirmRemove] = useState<ReportRow | null>(null);

  const load = async () => {
    setLoading(true);

    // Get all post ids in this tribe first (RLS allows owner to view reports for their posts)
    const { data: tribePosts } = await supabase
      .from("tribe_posts")
      .select("id")
      .eq("tribe_id", tribeId);
    const postIds = ((tribePosts as any) ?? []).map((p: any) => p.id);
    if (!postIds.length) {
      setReports([]);
      setLoading(false);
      return;
    }

    const { data: rawReports } = await supabase
      .from("tribe_post_reports")
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
      supabase.from("tribe_posts")
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
    if (open) { setConfirmRemove(null); load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tribeId]);

  const dismissReport = async (r: ReportRow) => {
    setBusyId(r.id);
    // Owners can't UPDATE reports (admin-only RLS) — instead we just hide it locally
    // and clear the post.reported flag so the badge disappears on the post card.
    if (r.post?.id) {
      await supabase
        .from("tribe_posts")
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
    setBusyId(r.id);
    const { error } = await supabase
      .from("tribe_posts")
      .delete()
      .eq("id", r.post.id);
    if (error) {
      toast.error(friendlyError(error));
      setBusyId(null);
      return;
    }
    setReports((prev) => prev.filter((x) => x.post_id !== r.post_id));
    setBusyId(null);
    toast.success("Post removed");
    onChanged?.();
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => onOpenChange(false)}
      label="Reports"
      title="Reports"
      subtitle="Posts your members flagged. Review and act fast."
      height="tall"
    >
      {loading ? (
        <div className="divide-y divide-border/35">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="py-4"><div className="h-20 rounded-xl skeleton-block bg-secondary/30" /></div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState size="compact" icon={ShieldCheck} title="No open reports" description="Tribe vibes are clean." />
      ) : (
        <div className="divide-y divide-border/35">
          {reports.map((r) => {
            const busy = busyId === r.id;
            return (
              <div key={r.id} className="py-4">
                <p className="text-[11px] font-bold text-destructive">{r.reason}</p>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Reported by @{r.reporter?.username ?? "user"} · {fmtRelative(r.created_at)}
                </p>

                {r.post ? (
                  <div className="rounded-xl bg-secondary/30 p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-6 w-6 rounded-full bg-secondary overflow-hidden shrink-0">
                        {r.post.author?.avatar_url ? (
                          <img loading="lazy" decoding="async" src={avatarUrl(r.post.author.avatar_url, 40)} alt="" className="h-full w-full object-cover" />
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
                      <AppImage
                        src={r.post.image_url}
                        width={320}
                        alt=""
                        className="rounded-md max-h-32 w-full object-cover border border-border/40"
                      />
                    )}
                    {r.post.video_url && <ReportVideo src={r.post.video_url} />}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Post no longer exists.</p>
                )}

                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1 min-h-11" loading={busy} onClick={() => dismissReport(r)}>
                    <Check size={14} /> Dismiss
                  </Button>
                  <Button size="sm" variant="danger-outline" className="flex-1 min-h-11" disabled={busy || !r.post} onClick={() => setConfirmRemove(r)}>
                    <Trash2 size={14} /> Remove post
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        onOpenChange={(o) => { if (!o) setConfirmRemove(null); }}
        title="Remove this post?"
        description="It disappears from the tribe for everyone. This cannot be undone."
        actionLabel="Remove post"
        onConfirm={() => {
          const r = confirmRemove;
          setConfirmRemove(null);
          if (r) void removePost(r);
        }}
      />
    </BottomSheet>
  );
}
