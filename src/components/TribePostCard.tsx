import { useState, useRef, useMemo, memo } from "react";
import StreakFlameInline from "@/components/StreakFlameInline";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import StatusAvatar from "@/components/StatusAvatar";
import TierUsername from "@/components/TierUsername";
import PostMedia from "@/components/feed/PostMedia";
import ImageLightbox from "@/components/ImageLightbox";
import {
  Flame, MessageCircle, Award, MoreHorizontal,
  AlertTriangle, Trash2, ShieldCheck, Crown, Reply, X, Send, Zap,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const isUnsupportedHeic = (value: string) => /\.hei(c|f)$/i.test(value);

// Comment-tree helpers are shared with EliteFeed — see src/lib/comment-tree.ts.
import { buildCommentTree, MAX_VISUAL_DEPTH, type CommentNode } from "@/lib/comment-tree";
import { friendlyError } from "@/lib/error-copy";

/**
 * Shared look for the Reply / Edit / Delete actions on a comment: uppercase
 * micro-label, muted until hover, and a hit area two steps wider than the
 * 28px box so the `xs` size stays tappable on a phone.
 */
const COMMENT_ACTION =
  "relative uppercase tracking-wider font-bold text-muted-foreground/75 hover:text-[hsl(var(--ember))] before:absolute before:-inset-2 before:content-['']";

const isEdited = (node: CommentNode) => {
  if (!node.updated_at || !node.created_at) return false;
  return new Date(node.updated_at).getTime() - new Date(node.created_at).getTime() > 1500;
};

interface CommentThreadProps {
  node: CommentNode;
  currentUserId?: string;
  canDeleteAny: boolean;
  onReply: (id: string, username: string, snippet: string) => void;
  onEdit: (id: string, content: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
}

const CommentThread = ({
  node, currentUserId, canDeleteAny, onReply, onEdit, onDelete, editingId, setEditingId,
}: CommentThreadProps) => {
  const username = node.profile?.username || "anon";
  const isReply = node.depth > 0;
  const isOwn = currentUserId && node.user_id === currentUserId;
  const isEditing = editingId === node.id;
  const [draft, setDraft] = useState(node.content || "");
  const [saving, setSaving] = useState(false);

  const cancelEdit = () => {
    setDraft(node.content || "");
    setEditingId(null);
  };

  const saveEdit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === (node.content || "").trim()) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      await onEdit(node.id, trimmed);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex gap-2.5 relative">
        {isReply && (
          <span aria-hidden="true" className="absolute -left-3 top-0 bottom-0 w-px bg-gradient-to-b from-[hsl(var(--ember))]/30 via-[hsl(var(--ember))]/15 to-transparent" />
        )}
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[hsl(var(--ember))] to-gold flex items-center justify-center text-[11px] font-black text-background shrink-0 mt-0.5">
          {username.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn(
            "border rounded-2xl rounded-tl-sm px-3 py-2 max-w-full",
            isEditing ? "block" : "inline-block",
            isReply ? "bg-card border-[hsl(var(--ember))]/25" : "bg-card border-border/40",
            isEditing && "border-[hsl(var(--ember))]/60",
          )}>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-[hsl(var(--ember))]">@{username}</span>
              {isEdited(node) && !isEditing && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--ember))]/70 italic">· edited</span>
              )}
            </div>
            {isEditing ? (
              <div className="mt-1.5 flex flex-col gap-2 min-w-[200px]">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 300))}
                  rows={2}
                  autoFocus
                  className="w-full bg-background/50 border border-[hsl(var(--ember))]/30 focus:border-[hsl(var(--ember))] rounded-lg px-2 py-1.5 text-xs text-foreground/90 outline-none resize-none focus:ring-2 focus:ring-[hsl(var(--ember))]/30"
                  onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); cancelEdit(); } }}
                />
                <div className="flex items-center justify-end gap-1.5">
                  {/* Save was a left-to-right ember→gold gradient — a third
                      orange language beside the system's vertical machined one. */}
                  <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="ember"
                    size="sm"
                    loading={saving}
                    disabled={!draft.trim()}
                    onClick={() => { hapticImpact("light"); saveEdit(); }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-foreground/90 leading-relaxed break-words whitespace-pre-wrap">
                {node.content}
              </p>
            )}
          </div>
          {!isEditing && (
            <div className="flex items-center gap-2 mt-0.5 ml-3 flex-wrap">
              <p className="text-[10px] text-muted-foreground/75">
                {formatDistanceToNow(new Date(node.created_at), { addSuffix: true })}
              </p>
              {/* Three copies of one class string became three uses of the new
                  `xs` size — small enough to sit on a comment's meta line, with
                  the hit area expanded past its visual box to stay tappable. */}
              {currentUserId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className={COMMENT_ACTION}
                  onClick={() => { hapticSelection(); onReply(node.id, username, node.content || ""); }}
                >
                  <Reply aria-hidden size={12} /> Reply
                </Button>
              )}
              {isOwn && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className={COMMENT_ACTION}
                  onClick={() => { hapticSelection(); setDraft(node.content || ""); setEditingId(node.id); }}
                >
                  Edit
                </Button>
              )}
              {(isOwn || canDeleteAny) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className={cn(COMMENT_ACTION, "hover:text-destructive")}
                  onClick={() => {
                    if (confirm("Delete this comment? Replies will also be removed.")) {
                      hapticImpact("medium");
                      onDelete(node.id);
                    }
                  }}
                >
                  Delete
                </Button>
              )}
              {node.children.length > 0 && (
                <span className="text-[10px] text-muted-foreground/75 tabular-nums">
                  · {node.children.length} {node.children.length === 1 ? "reply" : "replies"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {node.children.length > 0 && (
        <div className={cn(
          "mt-2.5 space-y-2.5 relative",
          node.depth < MAX_VISUAL_DEPTH ? "ml-6 pl-3 border-l border-[hsl(var(--ember))]/15" : "ml-3 pl-3 border-l border-dashed border-[hsl(var(--ember))]/20",
        )}>
          {node.children.map((child: CommentNode) => (
            <CommentThread key={child.id} node={child} currentUserId={currentUserId} canDeleteAny={canDeleteAny}
              onReply={onReply} onEdit={onEdit} onDelete={onDelete} editingId={editingId} setEditingId={setEditingId} />
          ))}
        </div>
      )}
    </div>
  );
};

export interface TribePostCardPost {
  id: string;
  user_id: string;
  tribe_id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  likes_count: number;
  comments_count: number;
  kudos_count: number;
  reported: boolean;
  created_at: string;
  /** Server-side moderation gate (S7a) — others see the post only when approved. */
  moderation_status?: string;
  liked?: boolean;
  kudosed?: boolean;
  author?: {
    username: string;
    avatar_url: string | null;
    status_tier: string | null;
    level?: number;
    streak?: number;
  };
}

interface Props {
  post: TribePostCardPost;
  isMember: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  canKudos: boolean; // Apex/Legend or apex subscriber
  kudosRemaining: number;
  onChanged: () => void;
}

const TribePostCard = ({ post, isMember, isOwner, isAdmin, canKudos, kudosRemaining, onChanged }: Props) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string; snippet: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const isOwn = user?.id === post.user_id;
  const isApexAuthor = post.author?.status_tier === "apex" || post.author?.status_tier === "legend";

  // Comments
  const { data: comments } = useQuery({
    queryKey: ["tribe-post-comments", post.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tribe_post_comments")
        .select("*")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (!data) return [];
      const userIds = [...new Set((data as any[]).map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      return (data as any[]).map((c) => ({ ...c, profile: profileMap[c.user_id] }));
    },
    enabled: showComments,
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !commentText.trim()) return;
      const { error } = await supabase.from("tribe_post_comments").insert({
        post_id: post.id,
        user_id: user.id,
        content: commentText.trim(),
        parent_id: replyTo?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ["tribe-post-comments", post.id] });
      onChanged();
    },
    onError: (e: any) => toast.error(friendlyError(e, "Failed to comment")),
  });

  const editComment = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("tribe_post_comments")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment updated");
      queryClient.invalidateQueries({ queryKey: ["tribe-post-comments", post.id] });
    },
    onError: (e: any) => toast.error(friendlyError(e, "Failed to update")),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("tribe_post_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment deleted");
      queryClient.invalidateQueries({ queryKey: ["tribe-post-comments", post.id] });
      onChanged();
    },
    onError: (e: any) => toast.error(friendlyError(e, "Failed to delete")),
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) return;
      hapticImpact(post.liked ? "light" : "medium");
      const { error } = post.liked
        ? await supabase.from("tribe_post_reactions").delete()
            .eq("post_id", post.id).eq("user_id", user.id)
        : await supabase.from("tribe_post_reactions").insert({
            post_id: post.id, user_id: user.id,
          });
      if (error) throw error;
    },
    onSuccess: () => onChanged(),
  });

  const toggleKudos = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (post.kudosed) {
        const { error } = await supabase.from("tribe_post_kudos").delete()
          .eq("post_id", post.id).eq("giver_id", user.id);
        if (error) throw error;
      } else {
        if (kudosRemaining <= 0) throw new Error("Monthly kudos used up");
        const { error } = await supabase.from("tribe_post_kudos").insert({
          post_id: post.id, giver_id: user.id, receiver_id: post.user_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(post.kudosed ? "Kudos removed" : "Kudos! 🏆");
      onChanged();
    },
    onError: (e: any) => toast.error(friendlyError(e, "Kudos failed")),
  });

  const reportPost = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error: reportErr } = await supabase.from("tribe_post_reports").insert({
        post_id: post.id, reporter_id: user.id, reason: "Reported by user",
      });
      if (reportErr) throw reportErr;
      const { error: flagErr } = await supabase.from("tribe_posts").update({ reported: true }).eq("id", post.id);
      if (flagErr) throw flagErr;
    },
    onSuccess: () => {
      toast.success("Post reported", { description: "Tribe owner will review it." });
      onChanged();
    },
    onError: () => toast.error("Failed to report"),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tribe_posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      onChanged();
    },
    onError: (e: any) => toast.error(friendlyError(e, "Failed to delete")),
  });

  // Memoize comment tree — avoids rebuilding on every render that doesn't change comments.
  const tree = useMemo(() => buildCommentTree(comments), [comments]);
  const canDeleteAnyComment = isAdmin || isOwner;

  return (
    <>
      <div className={cn(
        "rounded-2xl border bg-card overflow-hidden",
        isApexAuthor
          ? "border-[hsl(var(--ember))]/40 shadow-[0_0_18px_hsl(var(--ember)/0.18)]"
          : "border-border",
        post.reported && "ring-1 ring-destructive/40",
      )}>
        {/* Reported banner (admin/owner) */}
        {post.reported && (isAdmin || isOwner) && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/30 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-destructive flex items-center gap-1">
              <AlertTriangle aria-hidden size={11} /> Reported
            </span>
            <Button
              variant="danger-outline"
              size="xs"
              className="relative before:absolute before:-inset-2 before:content-['']"
              onClick={() => deletePost.mutate()}
            >
              Remove
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 p-4 pb-0">
          <StatusAvatar
            src={post.author?.avatar_url}
            name={post.author?.username}
            tier={(post.author?.status_tier as any) || "recruit"}
            size="sm"
            animated={false}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <button onClick={() => navigate(`/user/${post.user_id}`)}
                className="text-sm font-bold truncate hover:underline">
                <TierUsername
                  username={post.author?.username}
                  tier={(post.author?.status_tier as any) || "recruit"}
                  fallback="user"
                />
                {isOwn && <span className="ml-1 text-[11px] text-[hsl(var(--ember))]/70 font-medium">(you)</span>}
              </button>
              {isApexAuthor && (
                <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-[hsl(var(--ember))]/15 border border-[hsl(var(--ember))]/40">
                  <Zap aria-hidden size={7} className="text-[hsl(var(--ember))]" fill="currentColor" />
                  <span className="text-[10px] font-black tracking-wider uppercase text-[hsl(var(--ember))]">Apex</span>
                </span>
              )}
              {post.author?.status_tier === "elite" && (
                <Crown role="img" aria-label="Elite tier" size={11} className="text-gold shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
              {post.moderation_status === "pending" && (
                <span className="inline-flex items-center px-1.5 py-px rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-400 font-bold uppercase tracking-wider">
                  Reviewing…
                </span>
              )}
              {(post.author?.streak ?? 0) > 0 && (
                <><span>•</span><StreakFlameInline streak={post.author?.streak ?? 0} suffix="d" className="text-[11px]" /></>
              )}
            </div>
          </div>
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Post options" className="text-muted-foreground/75">
                  <MoreHorizontal aria-hidden size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                {isOwn && (
                  <DropdownMenuItem onClick={() => { if (confirm("Delete this post?")) deletePost.mutate(); }}
                    className="text-destructive focus:text-destructive">
                    <Trash2 aria-hidden size={14} className="mr-2" /> Delete post
                  </DropdownMenuItem>
                )}
                {!isOwn && (
                  <DropdownMenuItem onClick={() => reportPost.mutate()} className="text-destructive focus:text-destructive">
                    <AlertTriangle aria-hidden size={14} className="mr-2" /> Report post
                  </DropdownMenuItem>
                )}
                {(isAdmin || isOwner) && !isOwn && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => deletePost.mutate()} className="text-destructive focus:text-destructive">
                      <ShieldCheck aria-hidden size={14} className="mr-2" /> {isOwner ? "Owner: Remove" : "Admin: Remove"}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Content */}
        {post.content && (
          <p className="px-4 pt-3 text-sm leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>
        )}

        {/* Image */}
        {post.image_url && (
          <PostMedia
            imageUrl={post.image_url}
            alt={post.content || "Tribe post"}
            tier={(post.author?.status_tier as any) || undefined}
            onOpenImage={() => { hapticSelection(); setLightboxOpen(true); }}
          />
        )}

        {/* Video */}
        {post.video_url && <PostMedia videoUrl={post.video_url} />}

        {/* Actions */}
        <div className="flex items-center gap-1 px-3 py-2.5 mt-1 border-t border-border/40">
          {isMember && (
            <button onClick={() => toggleLike.mutate()}
              aria-label={post.liked ? "Remove fire" : "Give fire"}
              className={cn(
                "flex items-center gap-1.5 px-3 h-11 min-w-11 rounded-full text-xs font-bold transition-all active:scale-95",
                post.liked
                  ? "bg-streak-orange/15 text-streak-orange"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}>
              <Flame aria-hidden size={15} fill={post.liked ? "currentColor" : "none"} className={cn(post.liked && "animate-scale-in")} />
              <span className="tabular-nums">{post.likes_count > 0 ? post.likes_count : ""}</span>
            </button>
          )}
          <button onClick={() => { hapticSelection(); setReplyTo(null); setShowComments(!showComments); }}
            aria-label="Toggle comments"
            className={cn(
              "flex items-center gap-1.5 px-3 h-11 min-w-11 rounded-full text-xs font-bold transition-all active:scale-95",
              showComments ? "bg-[hsl(var(--ember))]/12 text-[hsl(var(--ember))]" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
            <MessageCircle aria-hidden size={15} fill={showComments ? "currentColor" : "none"} />
            <span className="tabular-nums">{post.comments_count > 0 ? post.comments_count : ""}</span>
          </button>

          {/* Kudos — only Apex/Legend can give, not on own post */}
          {!isOwn && isMember && canKudos && (
            <button onClick={() => {
              if (!post.kudosed && kudosRemaining <= 0) {
                toast.error("You've used both kudos this month");
                return;
              }
              hapticImpact("medium");
              toggleKudos.mutate();
            }}
              disabled={toggleKudos.isPending}
              aria-label={post.kudosed ? "Remove kudos" : "Give kudos"}
              title={`${kudosRemaining}/2 kudos remaining this month`}
              className={cn(
                "flex items-center gap-1.5 px-3 h-11 min-w-11 rounded-full text-xs font-bold transition-all active:scale-95",
                post.kudosed
                  ? "bg-purple/15 text-purple ring-1 ring-purple/30"
                  : kudosRemaining > 0
                    ? "text-muted-foreground hover:bg-purple/10 hover:text-purple"
                    : "text-muted-foreground/75 cursor-not-allowed"
              )}>
              <Award aria-hidden size={15} fill={post.kudosed ? "currentColor" : "none"} className={cn(post.kudosed && "animate-scale-in")} />
              <span className="tabular-nums">{post.kudos_count > 0 ? post.kudos_count : ""}</span>
            </button>
          )}

          {/* Show kudos count for own post */}
          {isOwn && post.kudos_count > 0 && (
            <div className="flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold text-purple bg-purple/10">
              <Award aria-hidden size={15} fill="currentColor" />
              <span className="tabular-nums">{post.kudos_count}</span>
            </div>
          )}

        </div>

        {/* Comments */}
        {showComments && (
          <div className="border-t border-border/50 px-4 py-3 bg-secondary/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Discussion</p>
              <p className="text-[11px] text-muted-foreground/75 tabular-nums">
                {post.comments_count} {post.comments_count === 1 ? "reply" : "replies"}
              </p>
            </div>

            <div className="space-y-3 mb-3 max-h-80 overflow-y-auto pr-1">
              {tree.length === 0 && (
                <p className="text-xs text-muted-foreground/75 text-center py-3">
                  No comments yet — start the conversation
                </p>
              )}
              {tree.map((node) => (
                <CommentThread
                  key={node.id}
                  node={node}
                  currentUserId={user?.id}
                  canDeleteAny={canDeleteAnyComment}
                  onReply={(id, username, snippet) => {
                    setReplyTo({ id, username, snippet });
                    setTimeout(() => commentInputRef.current?.focus(), 50);
                  }}
                  onEdit={async (id, content) => { await editComment.mutateAsync({ id, content }); }}
                  onDelete={async (id) => { await deleteComment.mutateAsync(id); }}
                  editingId={editingCommentId}
                  setEditingId={setEditingCommentId}
                />
              ))}
            </div>

            {isMember ? (
              <div className="pt-2 border-t border-border/30">
                {replyTo && (
                  <div className="mb-2 flex items-stretch gap-2 rounded-xl border border-[hsl(var(--ember))]/30 bg-[hsl(var(--ember))]/[0.06] p-2 animate-fade-in">
                    <div className="w-0.5 rounded-full bg-[hsl(var(--ember))] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-[hsl(var(--ember))] uppercase tracking-wider">
                        <Reply aria-hidden size={12} /> Replying to @{replyTo.username}
                      </div>
                      <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5 break-words">
                        {replyTo.snippet || "(no text)"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      aria-label="Cancel reply"
                      className="self-start h-6 w-6 rounded-full shrink-0 relative text-muted-foreground before:absolute before:-inset-2 before:content-['']"
                      onClick={() => { hapticSelection(); setReplyTo(null); }}
                    >
                      <X aria-hidden size={12} />
                    </Button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[hsl(var(--ember))] to-gold flex items-center justify-center text-[11px] font-black text-background shrink-0">
                    {profile?.username?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0 relative">
                    <input
                      ref={commentInputRef}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={replyTo ? `Reply to @${replyTo.username}...` : "Add a comment..."}
                      aria-label={replyTo ? `Reply to @${replyTo.username}` : "Add a comment"}
                      maxLength={300}
                      className={cn(
                        "w-full h-9 pl-3 pr-12 rounded-full border bg-background text-xs text-foreground placeholder:text-muted-foreground/75 focus:outline-none focus:ring-2 transition-all",
                        replyTo
                          ? "border-[hsl(var(--ember))]/40 focus:ring-[hsl(var(--ember))]/50 focus:border-[hsl(var(--ember))]/60"
                          : "border-border focus:ring-[hsl(var(--ember))]/40 focus:border-[hsl(var(--ember))]/40",
                      )}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && commentText.trim()) { hapticImpact("light"); addComment.mutate(); }
                        else if (e.key === "Escape" && replyTo) setReplyTo(null);
                      }}
                    />
                    {commentText.length > 0 && (
                      <span className={cn(
                        "absolute right-12 top-1/2 -translate-y-1/2 text-[10px] font-semibold tabular-nums",
                        commentText.length > 270 ? "text-destructive" : "text-muted-foreground/75"
                      )}>
                        {300 - commentText.length}
                      </span>
                    )}
                  </div>
                  {/* Same gradient fix as Save above: the system's ember when
                      there's something to send, quiet secondary when there isn't. */}
                  <Button
                    variant={commentText.trim() ? "ember" : "secondary"}
                    size="icon"
                    className="rounded-full shrink-0"
                    disabled={!commentText.trim() || addComment.isPending}
                    aria-label={replyTo ? "Send reply" : "Send comment"}
                    onClick={() => { hapticImpact("light"); addComment.mutate(); }}
                  >
                    <Send aria-hidden size={14} />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground text-center py-2">
                Join this tribe to comment.
              </p>
            )}
          </div>
        )}
      </div>

      <ImageLightbox
        open={lightboxOpen}
        imageUrl={post.image_url}
        username={post.author?.username}
        avatarUrl={post.author?.avatar_url}
        tier={(post.author?.status_tier as any) || "recruit"}
        level={post.author?.level}
        streak={post.author?.streak}
        likes={post.likes_count}
        comments={post.comments_count}
        kudos={post.kudos_count}
        caption={post.content}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
};

// Memoize so EliteFeed state changes (filter, search, typing) don't re-render
// all 50 cards simultaneously. Props are stable: post comes from query data,
// booleans are primitives, and onChanged is wrapped in useCallback upstream.
export default memo(TribePostCard);
