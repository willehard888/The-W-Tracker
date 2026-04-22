
import { useAuth } from "@/contexts/AuthContext";
import StreakFlameInline from "@/components/StreakFlameInline";
import LazyVideoPlayer from "@/components/LazyVideoPlayer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useModeration } from "@/hooks/use-moderation";
import ModerationGate from "@/components/ModerationGate";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import PullRefreshIndicator from "@/components/PullRefreshIndicator";
import { Button } from "@/components/ui/button";
import { Flame, Heart, MessageCircle, Send, Image, Flag, Lock, Crown, MoreHorizontal, AlertTriangle, Trash2, ShieldCheck, Eye, EyeOff, CheckCircle, Video, Award, Reply, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierConfig } from "@/lib/status-tiers";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import StatusAvatar from "@/components/StatusAvatar";
import TierUsername from "@/components/TierUsername";
import ImageLightbox from "@/components/ImageLightbox";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TIER_STYLES: Record<string, string> = {
  elite: "bg-gradient-to-br from-gold to-amber-600",
  high_performer: "bg-gradient-to-br from-purple-500 to-indigo-600",
  rising: "bg-gradient-to-br from-sky-400 to-blue-600",
  normal: "bg-secondary",
};

const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const SUPPORTED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
const MAX_IMAGE_SIZE_MB = 8;
const MAX_VIDEO_SIZE_MB = 50;

const isUnsupportedHeic = (value: string) => /\.hei(c|f)$/i.test(value);
const isVideoUrl = (url: string) => SUPPORTED_VIDEO_EXTENSIONS.some(ext => url.toLowerCase().includes(ext));

// Build a nested comment tree from a flat list using parent_id.
// Top-level comments have parent_id = null. Replies are nested under their parent.
type CommentNode = any & { children: CommentNode[]; depth: number };
const MAX_VISUAL_DEPTH = 4; // cap visual indentation to keep mobile readable
const buildCommentTree = (flat: any[] | undefined): CommentNode[] => {
  if (!flat || flat.length === 0) return [];
  const map = new Map<string, CommentNode>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [], depth: 0 }));
  const roots: CommentNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!;
      node.depth = Math.min(parent.depth + 1, MAX_VISUAL_DEPTH);
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  // Sort children by oldest-first within each branch
  const sortRec = (nodes: CommentNode[]) => {
    nodes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
};

interface CommentThreadProps {
  node: CommentNode;
  currentUserId?: string;
  onReply: (id: string, username: string, snippet: string) => void;
  onEdit: (id: string, content: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
}

const isEdited = (node: CommentNode) => {
  if (!node.updated_at || !node.created_at) return false;
  return new Date(node.updated_at).getTime() - new Date(node.created_at).getTime() > 1500;
};

const CommentThread = ({
  node,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  editingId,
  setEditingId,
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
        {/* Vertical thread line for replies */}
        {isReply && (
          <span
            aria-hidden="true"
            className="absolute -left-3 top-0 bottom-0 w-px bg-gradient-to-b from-gold/30 via-gold/15 to-transparent"
          />
        )}
        <div className="h-7 w-7 rounded-full gradient-gold flex items-center justify-center text-[10px] font-black text-primary-foreground shrink-0 mt-0.5">
          {username.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "border rounded-2xl rounded-tl-sm px-3 py-2 max-w-full",
              isEditing ? "block" : "inline-block",
              isReply
                ? "bg-card border-gold/25 shadow-[0_0_0_1px_hsl(var(--gold)/0.05)]"
                : "bg-card border-border/40",
              isEditing && "border-gold/60 shadow-[0_0_0_1px_hsl(var(--gold)/0.2)]",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gold">@{username}</span>
              {isEdited(node) && !isEditing && (
                <span className="text-[9px] font-semibold uppercase tracking-wider text-gold/70 italic">
                  · edited
                </span>
              )}
            </div>
            {isEditing ? (
              <div className="mt-1.5 flex flex-col gap-2 min-w-[200px]">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 300))}
                  rows={2}
                  autoFocus
                  className="w-full bg-background/50 border border-gold/30 focus:border-gold rounded-lg px-2 py-1.5 text-xs text-foreground/90 outline-none resize-none focus:ring-2 focus:ring-gold/30"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { hapticImpact("light"); saveEdit(); }}
                    disabled={saving || !draft.trim()}
                    className="text-[10px] font-black uppercase tracking-wider gradient-gold text-primary-foreground px-3 py-1 rounded-md disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
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
              <p className="text-[9px] text-muted-foreground/50">
                {formatDistanceToNow(new Date(node.created_at), { addSuffix: true })}
              </p>
              {currentUserId && (
                <button
                  type="button"
                  onClick={() => {
                    hapticSelection();
                    onReply(node.id, username, node.content || "");
                  }}
                  className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-gold transition-colors"
                >
                  <Reply size={10} />
                  Reply
                </button>
              )}
              {isOwn && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      hapticSelection();
                      setDraft(node.content || "");
                      setEditingId(node.id);
                    }}
                    className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-gold transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this comment? Replies will also be removed.")) {
                        hapticImpact("medium");
                        onDelete(node.id);
                      }
                    }}
                    className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-destructive transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
              {node.children.length > 0 && (
                <span className="text-[9px] text-muted-foreground/40 tabular-nums">
                  · {node.children.length} {node.children.length === 1 ? "reply" : "replies"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recursive children */}
      {node.children.length > 0 && (
        <div
          className={cn(
            "mt-2.5 space-y-2.5 relative",
            // Indent up to MAX_VISUAL_DEPTH; cap to keep mobile readable
            node.depth < MAX_VISUAL_DEPTH ? "ml-6 pl-3 border-l border-gold/15" : "ml-3 pl-3 border-l border-dashed border-gold/20",
          )}
        >
          {node.children.map((child: CommentNode) => (
            <CommentThread
              key={child.id}
              node={child}
              currentUserId={currentUserId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              editingId={editingId}
              setEditingId={setEditingId}
            />
          ))}
        </div>
      )}
    </div>
  );
};


const EliteFeed = () => {
  const { user, profile, isElite } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState("");
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string; snippet: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [showReported, setShowReported] = useState(false);
  const [showReportsPanel, setShowReportsPanel] = useState(false);
  const [lightboxPost, setLightboxPost] = useState<any | null>(null);

  // Pull-to-refresh
  const { scrollRef, pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd, PULL_THRESHOLD } = usePullRefresh([["elite-feed"]]);
  const moderation = useModeration();

  // Check if current user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["user-role-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: posts, isLoading } = useQuery({
    queryKey: ["feed-posts", showReported],
    queryFn: async () => {
      let query = supabase
        .from("feed_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      // Non-admins or admins not viewing reported: hide reported posts
      if (!showReported) {
        query = query.eq("reported", false);
      }

      const { data } = await query;
      if (!data) return [];
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier, streak, level, is_elite")
        .in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
      return data.map((post) => ({ ...post, profile: profileMap[post.user_id] }));
    },
  });

  // Fetch reports for admin panel
  const { data: reports } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!data || data.length === 0) return [];
      // Get post info and reporter info
      const postIds = [...new Set(data.filter(r => r.post_id).map(r => r.post_id!))];
      const reporterIds = [...new Set(data.map(r => r.reporter_id))];
      const [{ data: postData }, { data: reporterData }] = await Promise.all([
        postIds.length > 0
          ? supabase.from("feed_posts").select("id, content, user_id, image_url").in("id", postIds)
          : Promise.resolve({ data: [] }),
        supabase.from("profiles").select("user_id, username").in("user_id", reporterIds),
      ]);
      const postMap = Object.fromEntries((postData || []).map(p => [p.id, p]));
      const reporterMap = Object.fromEntries((reporterData || []).map(p => [p.user_id, p]));
      return data.map(r => ({ ...r, post: postMap[r.post_id!], reporter: reporterMap[r.reporter_id] }));
    },
    enabled: !!isAdmin,
  });

  // Kudos: which posts the user has kudos'd
  const { data: userKudosPosts } = useQuery({
    queryKey: ["user-kudos-posts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("kudos")
        .select("post_id")
        .eq("giver_id", user.id);
      return data?.map((k: any) => k.post_id) || [];
    },
    enabled: !!user,
  });

  // Kudos: how many the user has given this month
  const { data: kudosGivenThisMonth } = useQuery({
    queryKey: ["kudos-given-month", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("kudos")
        .select("id", { count: "exact", head: true })
        .eq("giver_id", user.id)
        .gte("created_at", startOfMonth);
      return count || 0;
    },
    enabled: !!user,
  });

  const kudosRemaining = Math.max(0, 2 - (kudosGivenThisMonth || 0));

  const { data: reactions } = useQuery({
    queryKey: ["feed-reactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("feed_reactions")
        .select("post_id")
        .eq("user_id", user.id);
      return data?.map((r) => r.post_id) || [];
    },
    enabled: !!user,
  });

  const createPost = useMutation({
    mutationFn: async () => {
      if (!user) return;
      let image_url = null;
      let video_url = null;

      // Moderate image FIRST (thumbnail) — skip upload if blocked
      if (imageFile) {
        const outcome = await moderation.moderateImage({
          file: imageFile,
          kind: "feed_post",
        });
        if (outcome.blocked) {
          throw new Error(outcome.friendlyMessage ?? "Post rejected by content policy");
        }
      }

      // Moderate text in parallel-ish (fail-open inside hook)
      if (newPost && newPost.trim().length > 0 && !imageFile) {
        const outcome = await moderation.moderateText({
          text: newPost.trim(),
          kind: "feed_post",
        });
        if (outcome.blocked) {
          throw new Error(outcome.friendlyMessage ?? "Post rejected by content policy");
        }
      }

      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const safeExt = ["jpeg", "jpg", "png", "webp", "heic", "heif"].includes(fileExt) ? fileExt : "jpg";
        const path = `${user.id}/${Date.now()}.${safeExt}`;
        const contentType = imageFile.type || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`;
        const { error: uploadErr } = await supabase.storage.from("feed-images").upload(path, imageFile, {
          cacheControl: "3600",
          upsert: false,
          contentType,
        });
        if (uploadErr) throw new Error(`Image upload failed: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage.from("feed-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      if (videoFile) {
        const fileExt = videoFile.name.split(".").pop()?.toLowerCase() || "mp4";
        const path = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from("feed-images").upload(path, videoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: videoFile.type || `video/${fileExt}`,
        });
        if (uploadErr) throw new Error(`Video upload failed: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage.from("feed-images").getPublicUrl(path);
        video_url = urlData.publicUrl;
      }

      await supabase.from("feed_posts").insert({
        user_id: user.id,
        content: newPost || null,
        image_url,
        video_url,
      } as any);
    },
    onSuccess: () => {
      setNewPost("");
      setImageFile(null);
      setImagePreview(null);
      setVideoFile(null);
      setVideoPreview(null);
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("Posted! 🔥");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create post. Try again.");
    },
  });

  const toggleReaction = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) return;
      const liked = reactions?.includes(postId);
      hapticImpact(liked ? "light" : "medium");
      if (liked) {
        await supabase.from("feed_reactions").delete().eq("post_id", postId).eq("user_id", user.id);
      } else {
        await supabase.from("feed_reactions").insert({ post_id: postId, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-reactions"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    },
  });

  const giveKudos = useMutation({
    mutationFn: async ({ postId, receiverId }: { postId: string; receiverId: string }) => {
      if (!user || !canPost) return;
      if (kudosRemaining <= 0) {
        throw new Error("Monthly kudos used up");
      }
      const alreadyGiven = userKudosPosts?.includes(postId);
      if (alreadyGiven) {
        await supabase.from("kudos").delete().eq("post_id", postId).eq("giver_id", user.id);
      } else {
        await supabase.from("kudos").insert({
          giver_id: user.id,
          post_id: postId,
          receiver_id: receiverId,
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-kudos-posts"] });
      queryClient.invalidateQueries({ queryKey: ["kudos-given-month"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("Kudos! 🏆");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Kudos failed");
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["feed-comments", showComments],
    queryFn: async () => {
      if (!showComments) return [];
      const { data } = await supabase
        .from("feed_comments")
        .select("*")
        .eq("post_id", showComments)
        .order("created_at", { ascending: true });
      if (!data) return [];
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
      return data.map((c) => ({ ...c, profile: profileMap[c.user_id] }));
    },
    enabled: !!showComments,
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !showComments || !commentText.trim()) return;
      await supabase.from("feed_comments").insert({
        post_id: showComments,
        user_id: user.id,
        content: commentText.trim(),
        parent_id: replyTo?.id ?? null,
      });
    },
    onSuccess: () => {
      setCommentText("");
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ["feed-comments"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    },
  });

  const editComment = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("feed_comments")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment updated");
      queryClient.invalidateQueries({ queryKey: ["feed-comments"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update"),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("feed_comments")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment deleted");
      queryClient.invalidateQueries({ queryKey: ["feed-comments"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  const reportPost = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) return;
      await supabase.from("reports").insert({
        reporter_id: user.id,
        post_id: postId,
        reason: "Reported by user",
      });
      await supabase.from("feed_posts").update({ reported: true }).eq("id", postId);
    },
    onSuccess: () => {
      toast.success("Post reported", { description: "We'll review this content." });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    },
    onError: () => {
      toast.error("Failed to report post");
    },
  });

  // Admin: delete any post
  const adminDeletePost = useMutation({
    mutationFn: async (postId: string) => {
      await supabase.from("feed_posts").delete().eq("id", postId);
    },
    onSuccess: () => {
      toast.success("Post removed by admin");
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
  });

  // Own post delete
  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) return;
      await supabase.from("feed_posts").delete().eq("id", postId).eq("user_id", user.id);
    },
    onSuccess: () => {
      toast.success("Post deleted");
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    },
  });

  // Admin: unreport post
  const unreportPost = useMutation({
    mutationFn: async (postId: string) => {
      await supabase.from("feed_posts").update({ reported: false }).eq("id", postId);
    },
    onSuccess: () => {
      toast.success("Post approved");
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
  });

  // Admin: resolve report
  const resolveReport = useMutation({
    mutationFn: async ({ reportId, action }: { reportId: string; postId?: string; action: "approve" | "delete" }) => {
      await supabase.from("reports").update({ resolved: true }).eq("id", reportId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    
    // On iOS, camera photos may come as image/heic or without proper MIME
    // Accept any image/* type, plus known extensions
    const isImage = file.type.startsWith("image/") || 
      SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    
    if (!isImage) {
      toast.error("Please select an image file.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      toast.error(`Image is too large. Max ${MAX_IMAGE_SIZE_MB}MB.`);
      e.target.value = "";
      return;
    }
    setVideoFile(null);
    setVideoPreview(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isVideo = file.type.startsWith("video/") || 
      SUPPORTED_VIDEO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
    
    if (!isVideo) {
      toast.error("Please select a video file.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      toast.error(`Video is too large. Max ${MAX_VIDEO_SIZE_MB}MB.`);
      e.target.value = "";
      return;
    }
    setImageFile(null);
    setImagePreview(null);
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  // Posting requires *earned* Elite status (status_tier elite/apex/legend),
  // not just an active subscription. Reading is open to any member.
  const userTier = profile?.status_tier || 'recruit';
  const tierRank = getTierConfig(userTier).rank;
  const canPost = tierRank >= 4; // elite, apex, legend
  const unresolvedReportsCount = reports?.length || 0;
  const canView = true; // any member that passes AccessGate can read the feed

  return (
    <div
      ref={scrollRef}
      className="min-h-screen pb-4 px-4 pt-6 safe-top"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} threshold={PULL_THRESHOLD} />
      
      <div className="animate-reveal mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight leading-none my-[10px] py-[10px]">Elite Feed</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Discipline proof from top performers</p>
          </div>

          {/* Admin controls */}
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowReported(!showReported)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                  showReported
                    ? "bg-destructive/15 text-destructive border border-destructive/30"
                    : "bg-secondary text-muted-foreground hover:text-foreground border border-border"
                )}
              >
                {showReported ? <EyeOff size={12} /> : <Eye size={12} />}
                {showReported ? "Hide flagged" : "Flagged"}
              </button>
              <button
                onClick={() => setShowReportsPanel(!showReportsPanel)}
                className={cn(
                  "relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                  showReportsPanel
                    ? "bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))] border border-[hsl(var(--purple))]/30"
                    : "bg-secondary text-muted-foreground hover:text-foreground border border-border"
                )}
              >
                <ShieldCheck size={12} />
                Reports
                {unresolvedReportsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-black flex items-center justify-center">
                    {unresolvedReportsCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin Reports Panel */}
      {isAdmin && showReportsPanel && (
        <div className="animate-reveal rounded-2xl border border-[hsl(var(--purple))]/30 bg-card p-4 mb-6 shadow-[0_0_20px_hsl(var(--purple)/0.08)]">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-[hsl(var(--purple))]" />
            <h2 className="font-display text-sm font-bold">Pending Reports</h2>
            <span className="text-[10px] text-muted-foreground">({unresolvedReportsCount})</span>
          </div>
          {unresolvedReportsCount === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No pending reports 🎉</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {reports?.map((report: any) => (
                <div key={report.id} className="rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground">
                        Reported by <span className="font-semibold text-foreground">@{report.reporter?.username || "unknown"}</span>
                        {" · "}
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{report.reason}</p>
                      {report.post && (
                        <div className="mt-2 rounded-lg border border-border/50 bg-card p-2">
                          <p className="text-xs text-foreground/80 line-clamp-2">{report.post.content || "(image only)"}</p>
                          {report.post.image_url && (
                            <img src={report.post.image_url} alt="" className="mt-1 h-16 w-24 object-cover rounded" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Approve (unreport) */}
                      <button
                        onClick={async () => {
                          if (report.post_id) await unreportPost.mutateAsync(report.post_id);
                          resolveReport.mutate({ reportId: report.id, action: "approve" });
                        }}
                        className="h-7 px-2.5 rounded-lg bg-[hsl(var(--xp-green))]/15 text-[hsl(var(--xp-green))] text-[10px] font-bold hover:bg-[hsl(var(--xp-green))]/25 transition-colors flex items-center gap-1"
                      >
                        <CheckCircle size={12} />
                        Keep
                      </button>
                      {/* Delete post */}
                      <button
                        onClick={async () => {
                          if (report.post_id) await adminDeletePost.mutateAsync(report.post_id);
                          resolveReport.mutate({ reportId: report.id, action: "delete" });
                        }}
                        className="h-7 px-2.5 rounded-lg bg-destructive/15 text-destructive text-[10px] font-bold hover:bg-destructive/25 transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Post (Elite Only) */}
      {canPost && (
        <div className="animate-reveal animate-reveal-delay-1 rounded-2xl border border-gold/20 bg-card p-4 mb-6 shadow-[0_2px_16px_hsl(var(--gold)/0.06)]">
          <div className="flex gap-3">
            <div className="h-9 w-9 rounded-full gradient-gold flex items-center justify-center text-xs font-black text-primary-foreground shrink-0">
              {profile?.username?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Share your W today..."
              rows={2}
              maxLength={500}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none leading-relaxed"
            />
          </div>

          {imagePreview && (
            <div className="relative mt-3 rounded-xl overflow-hidden">
              <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-cover rounded-xl" />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          {videoPreview && (
            <div className="relative mt-3 rounded-xl overflow-hidden">
              <video src={videoPreview} className="w-full max-h-48 rounded-xl" controls />
              <button
                onClick={() => { setVideoFile(null); setVideoPreview(null); }}
                className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                <Image size={14} />
                Photo
              </button>
              <button
                onClick={() => videoRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                <Video size={14} />
                Video
              </button>
            </div>
            <Button
              variant="gold"
              size="sm"
              onClick={() => createPost.mutate()}
              disabled={createPost.isPending || (!newPost.trim() && !imageFile && !videoFile)}
              className="rounded-full px-5"
            >
              <Send size={12} />
              {createPost.isPending ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      )}

      {!canPost && user && (
        <div className="animate-reveal animate-reveal-delay-1 rounded-2xl border border-gold/25 bg-gold/5 p-6 text-center mb-6">
          <div className="h-12 w-12 rounded-full gradient-gold flex items-center justify-center mx-auto mb-3 glow-gold">
            <Crown size={20} className="text-primary-foreground" />
          </div>
          <p className="text-sm font-bold">Posting is for the Elite tier</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs mx-auto">
            Earn the Elite status — top 5% rank, 14 active days in 30, and a 30-day streak — to post here.
          </p>
          <Button variant="gold" size="sm" className="rounded-full" onClick={() => navigate("/profile")}>
            <Crown size={14} />
            View Road to Elite
          </Button>
        </div>
      )}

      {/* Posts */}
      <div className="space-y-4 animate-reveal animate-reveal-delay-2">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-secondary" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-24 bg-secondary rounded" />
                    <div className="h-2 w-16 bg-secondary rounded" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-secondary rounded" />
                  <div className="h-3 w-3/4 bg-secondary rounded" />
                </div>
              </div>
            ))}
          </div>
        )}
        {posts?.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
              <Flame size={28} className="text-gold/40" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">No posts yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Be the first to share your W</p>
          </div>
        )}

        {posts?.map((post: any, index: number) => {
          const isOwn = post.user_id === user?.id;
          const tierStyle = TIER_STYLES[post.profile?.status_tier] || TIER_STYLES.normal;
          const liked = reactions?.includes(post.id);
          const hasGivenKudos = userKudosPosts?.includes(post.id);

          return (
            <div
              key={post.id}
              className={cn(
                "rounded-2xl border bg-card overflow-hidden transition-all card-depth",
                "hover:shadow-[0_8px_32px_hsl(0_0%_0%/0.35),0_4px_12px_hsl(var(--gold)/0.06)]",
                post.reported ? "border-destructive/30 bg-destructive/[0.02]" : liked ? "border-gold/20" : "border-border"
              )}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Reported banner */}
              {post.reported && isAdmin && (
                <div className="flex items-center justify-between px-4 py-2 bg-destructive/10 border-b border-destructive/20">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-destructive" />
                    <span className="text-[10px] font-bold text-destructive uppercase tracking-wider">Reported</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => unreportPost.mutate(post.id)}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-[hsl(var(--xp-green))]/15 text-[hsl(var(--xp-green))] hover:bg-[hsl(var(--xp-green))]/25 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => adminDeletePost.mutate(post.id)}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Post Header */}
              <div className="flex items-center gap-3 p-4 pb-0">
                <StatusAvatar src={post.profile?.avatar_url} name={post.profile?.username} tier={post.profile?.status_tier || 'recruit'} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => navigate(`/user/${post.user_id}`)}
                      className="text-sm font-bold truncate hover:underline"
                    >
                      <TierUsername
                        username={post.profile?.username}
                        tier={post.profile?.status_tier || "recruit"}
                      />
                      {isOwn && <span className="ml-1 text-[10px] text-gold/70 font-medium">(you)</span>}
                    </button>
                    {post.profile?.status_tier === "elite" && (
                      <Crown size={12} className="text-gold shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                    {post.profile?.level > 0 && (
                      <>
                        <span>•</span>
                        <span className="font-semibold">Lv.{post.profile.level}</span>
                      </>
                    )}
                    {post.profile?.streak > 0 && (
                      <>
                        <span>•</span>
                        <StreakFlameInline streak={post.profile.streak} suffix="d" className="text-[10px]" />
                      </>
                    )}
                  </div>
                </div>

                {/* Post menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground/60 hover:text-muted-foreground">
                      <MoreHorizontal size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    {isOwn && (
                      <DropdownMenuItem
                        onClick={() => deletePost.mutate(post.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete post
                      </DropdownMenuItem>
                    )}
                    {!isOwn && (
                      <DropdownMenuItem
                        onClick={() => reportPost.mutate(post.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <AlertTriangle size={14} className="mr-2" />
                        Report post
                      </DropdownMenuItem>
                    )}
                    {/* Admin actions */}
                    {isAdmin && !isOwn && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => adminDeletePost.mutate(post.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <ShieldCheck size={14} className="mr-2" />
                          Admin: Remove
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Content */}
              {post.content && (
                <p className="px-4 pt-3 text-sm leading-relaxed overflow-wrap-break-word">{post.content}</p>
              )}

              {/* Image — tap to open premium lightbox */}
              {post.image_url && (
                <div className="mt-3 mx-4 rounded-xl overflow-hidden relative group">
                  {isUnsupportedHeic(post.image_url) ? (
                    <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
                      This image format is not supported in all devices. Please upload JPG, PNG or WEBP.
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { hapticSelection(); setLightboxPost(post); }}
                      className="block w-full text-left active:opacity-90 transition-opacity"
                      aria-label="Open image preview"
                    >
                      <img
                        src={post.image_url}
                        alt={post.content || "Post image"}
                        className="w-full max-h-96 object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                        loading="lazy"
                      />
                      {/* Subtle gradient + tier ribbon */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
                      {post.profile?.status_tier === "elite" && (
                        <div className="pointer-events-none absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border border-gold/40">
                          <Crown size={10} className="text-gold" />
                          <span className="text-[9px] font-black tracking-wider text-gold uppercase">Elite</span>
                        </div>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Video */}
              {(post as any).video_url && (
                <div className="mt-3 mx-4 rounded-xl overflow-hidden">
                  <LazyVideoPlayer src={(post as any).video_url} />
                </div>
              )}

              {/* Actions — themed for ranking system */}
              <div className="flex items-center gap-1 px-3 py-2.5 mt-1 border-t border-border/40">
                <button
                  onClick={() => toggleReaction.mutate(post.id)}
                  aria-label={liked ? "Remove fire" : "Give fire"}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold transition-all active:scale-95",
                    liked
                      ? "bg-streak-orange/15 text-streak-orange"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {liked ? (
                    <Flame size={15} fill="currentColor" className="animate-scale-in" />
                  ) : (
                    <Heart size={15} />
                  )}
                  <span className="tabular-nums">{post.likes_count > 0 ? post.likes_count : ""}</span>
                </button>
                <button
                  onClick={() => { hapticSelection(); setReplyTo(null); setShowComments(showComments === post.id ? null : post.id); }}
                  aria-label="Toggle comments"
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold transition-all active:scale-95",
                    showComments === post.id
                      ? "bg-gold/10 text-gold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <MessageCircle size={15} fill={showComments === post.id ? "currentColor" : "none"} />
                  <span className="tabular-nums">{post.comments_count > 0 ? post.comments_count : ""}</span>
                </button>

                {/* Kudos button — only for non-own posts, members with earned Elite status */}
                {!isOwn && canPost && (
                  <button
                    onClick={() => {
                      if (!hasGivenKudos && kudosRemaining <= 0) {
                        toast.error("You've used both kudos this month");
                        return;
                      }
                      hapticImpact("medium");
                      giveKudos.mutate({ postId: post.id, receiverId: post.user_id });
                    }}
                    disabled={giveKudos.isPending}
                    aria-label={hasGivenKudos ? "Remove kudos" : "Give kudos"}
                    className={cn(
                      "flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold transition-all active:scale-95",
                      hasGivenKudos
                        ? "bg-purple/15 text-purple ring-1 ring-purple/30"
                        : kudosRemaining > 0
                          ? "text-muted-foreground hover:bg-purple/10 hover:text-purple"
                          : "text-muted-foreground/40 cursor-not-allowed"
                    )}
                    title={`${kudosRemaining}/2 kudos remaining this month`}
                  >
                    <Award
                      size={15}
                      fill={hasGivenKudos ? "currentColor" : "none"}
                      className={cn(hasGivenKudos && "animate-scale-in")}
                    />
                    <span className="tabular-nums">{(post.kudos_count || 0) > 0 ? post.kudos_count : ""}</span>
                  </button>
                )}

                {/* Show kudos count for own posts */}
                {isOwn && (post.kudos_count || 0) > 0 && (
                  <div className="flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold text-purple bg-purple/10">
                    <Award size={15} fill="currentColor" />
                    <span className="tabular-nums">{post.kudos_count}</span>
                  </div>
                )}

                {/* Engagement summary on the right */}
                <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider">
                  {(post.likes_count || 0) + (post.comments_count || 0) + (post.kudos_count || 0) === 0 ? (
                    <span>Be first</span>
                  ) : (
                    <span>{(post.likes_count || 0) + (post.comments_count || 0) + (post.kudos_count || 0)} signals</span>
                  )}
                </div>
              </div>

              {/* Comments Section */}
              {showComments === post.id && (
                <div className="border-t border-border/50 px-4 py-3 bg-secondary/20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                      Discussion
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 tabular-nums">
                      {post.comments_count || 0} {post.comments_count === 1 ? "reply" : "replies"}
                    </p>
                  </div>

                  {(() => {
                    const tree = buildCommentTree(comments);
                    return (
                      <div className="space-y-3 mb-3 max-h-80 overflow-y-auto pr-1">
                        {tree.length === 0 && (
                          <p className="text-xs text-muted-foreground/60 text-center py-3">
                            No comments yet — start the conversation
                          </p>
                        )}
                        {tree.map((node) => (
                          <CommentThread
                            key={node.id}
                            node={node}
                            currentUserId={user?.id}
                            onReply={(id, username, snippet) => {
                              setReplyTo({ id, username, snippet });
                              setTimeout(() => commentInputRef.current?.focus(), 50);
                            }}
                            onEdit={async (id, content) => {
                              await editComment.mutateAsync({ id, content });
                            }}
                            onDelete={async (id) => {
                              await deleteComment.mutateAsync(id);
                            }}
                            editingId={editingCommentId}
                            setEditingId={setEditingCommentId}
                          />
                        ))}
                      </div>
                    );
                  })()}

                  {/* Composer */}
                  {user && (
                    <div className="pt-2 border-t border-border/30">
                      {/* Reply quote preview */}
                      {replyTo && (
                        <div className="mb-2 flex items-stretch gap-2 rounded-xl border border-gold/30 bg-gold/[0.06] p-2 animate-fade-in">
                          <div className="w-0.5 rounded-full bg-gold shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-gold uppercase tracking-wider">
                              <Reply size={10} />
                              Replying to @{replyTo.username}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 break-words">
                              {replyTo.snippet || "(no text)"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => { hapticSelection(); setReplyTo(null); }}
                            aria-label="Cancel reply"
                            className="self-start h-6 w-6 rounded-full bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}

                      <div className="flex items-end gap-2">
                        <div className="h-8 w-8 rounded-full gradient-gold flex items-center justify-center text-[10px] font-black text-primary-foreground shrink-0">
                          {profile?.username?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0 relative">
                          <input
                            ref={commentInputRef}
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder={replyTo ? `Reply to @${replyTo.username}...` : "Add a comment..."}
                            maxLength={300}
                            className={cn(
                              "w-full h-9 pl-3 pr-12 rounded-full border bg-background text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all",
                              replyTo
                                ? "border-gold/40 focus:ring-gold/50 focus:border-gold/60"
                                : "border-border focus:ring-gold/40 focus:border-gold/40",
                            )}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && commentText.trim()) {
                                hapticImpact("light");
                                addComment.mutate();
                              } else if (e.key === "Escape" && replyTo) {
                                setReplyTo(null);
                              }
                            }}
                          />
                          {commentText.length > 0 && (
                            <span
                              className={cn(
                                "absolute right-12 top-1/2 -translate-y-1/2 text-[9px] font-semibold tabular-nums",
                                commentText.length > 270 ? "text-destructive" : "text-muted-foreground/50"
                              )}
                            >
                              {300 - commentText.length}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => { hapticImpact("light"); addComment.mutate(); }}
                          disabled={!commentText.trim() || addComment.isPending}
                          aria-label={replyTo ? "Send reply" : "Send comment"}
                          className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0",
                            commentText.trim()
                              ? "gradient-gold text-primary-foreground glow-gold"
                              : "bg-secondary text-muted-foreground/40 cursor-not-allowed"
                          )}
                        >
                          <Send size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Premium full-screen image preview */}
      <ImageLightbox
        open={!!lightboxPost}
        imageUrl={lightboxPost?.image_url ?? null}
        username={lightboxPost?.profile?.username}
        avatarUrl={lightboxPost?.profile?.avatar_url}
        tier={lightboxPost?.profile?.status_tier || "recruit"}
        level={lightboxPost?.profile?.level}
        streak={lightboxPost?.profile?.streak}
        likes={lightboxPost?.likes_count}
        comments={lightboxPost?.comments_count}
        kudos={lightboxPost?.kudos_count}
        caption={lightboxPost?.content}
        onClose={() => setLightboxPost(null)}
      />
    </div>
  );
};

export default EliteFeed;
