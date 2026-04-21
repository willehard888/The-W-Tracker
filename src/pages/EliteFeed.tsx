
import { useAuth } from "@/contexts/AuthContext";
import EliteFeedTeaser from "@/components/EliteFeedTeaser";
import FeatureGateScreen from "@/components/FeatureGateScreen";
import LazyVideoPlayer from "@/components/LazyVideoPlayer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useModeration } from "@/hooks/use-moderation";
import ModerationGate from "@/components/ModerationGate";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import PullRefreshIndicator from "@/components/PullRefreshIndicator";
import { Button } from "@/components/ui/button";
import { Flame, Heart, MessageCircle, Send, Image, Flag, Lock, Crown, MoreHorizontal, AlertTriangle, Trash2, ShieldCheck, Eye, EyeOff, CheckCircle, Video, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierConfig } from "@/lib/status-tiers";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import StatusAvatar from "@/components/StatusAvatar";
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

const EliteFeed = () => {
  const { user, profile, isElite } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState("");
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [showReported, setShowReported] = useState(false);
  const [showReportsPanel, setShowReportsPanel] = useState(false);

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
      if (!user || !isElite) return;
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
      });
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["feed-comments"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    },
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

  const canPost = isElite;
  const unresolvedReportsCount = reports?.length || 0;

  // Tier-based gating: High Performer+ can view, Elite can post
  const userTier = profile?.status_tier || 'recruit';
  const tierRank = getTierConfig(userTier).rank;
  const canView = isElite || tierRank >= 3; // high_performer+

  if (!canView) {
    return (
      <FeatureGateScreen
        requiredTier="high_performer"
        currentTier={userTier as any}
        featureName="Elite Feed"
        description="See what top performers are doing. Reach High Performer status to unlock viewing access."
        icon={Flame}
        requiresElite={false}
      />
    );
  }

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
        <div className="animate-reveal animate-reveal-delay-1 rounded-2xl border border-border bg-card p-6 text-center mb-6">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
            <Lock size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-bold">Elite members can post</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Upgrade to share your discipline proof</p>
          <Button variant="gold" size="sm" className="rounded-full" onClick={() => navigate("/paywall")}>
            <Crown size={14} />
            Unlock Elite
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
                      className={cn("text-sm font-bold truncate hover:underline", isOwn && "text-gold")}
                    >
                      @{post.profile?.username || "unknown"} {isOwn && <span className="text-[10px] text-gold/70 font-medium">(you)</span>}
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
                        <span className="text-[hsl(var(--streak-orange))]">🔥 {post.profile.streak}d</span>
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

              {/* Image */}
              {post.image_url && (
                <div className="mt-3 mx-4 rounded-xl overflow-hidden">
                  {isUnsupportedHeic(post.image_url) ? (
                    <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
                      This image format is not supported in all devices. Please upload JPG, PNG or WEBP.
                    </div>
                  ) : (
                    <img
                      src={post.image_url}
                      alt=""
                      className="w-full max-h-96 object-cover transition-transform"
                      loading="lazy"
                    />
                  )}
                </div>
              )}

              {/* Video */}
              {(post as any).video_url && (
                <div className="mt-3 mx-4 rounded-xl overflow-hidden">
                  <LazyVideoPlayer src={(post as any).video_url} />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 px-4 py-3 mt-1">
                <button
                  onClick={() => toggleReaction.mutate(post.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95",
                    liked
                      ? "bg-gold/10 text-gold"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <Heart
                    size={15}
                    fill={liked ? "currentColor" : "none"}
                    className={cn(liked && "animate-scale-in")}
                  />
                  {post.likes_count > 0 && post.likes_count}
                </button>
                <button
                  onClick={() => setShowComments(showComments === post.id ? null : post.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95",
                    showComments === post.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <MessageCircle size={15} />
                  {post.comments_count > 0 && post.comments_count}
                </button>

                {/* Kudos button - only for non-own posts, elite users */}
                {!isOwn && isElite && (
                  <button
                    onClick={() => {
                      if (!hasGivenKudos && kudosRemaining <= 0) {
                        toast.error("Olet käyttänyt molemmat kudosit tässä kuussa");
                        return;
                      }
                      giveKudos.mutate({ postId: post.id, receiverId: post.user_id });
                    }}
                    disabled={giveKudos.isPending}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95",
                      hasGivenKudos
                        ? "bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))]"
                        : kudosRemaining > 0
                          ? "text-muted-foreground hover:bg-[hsl(var(--purple))]/10 hover:text-[hsl(var(--purple))]"
                          : "text-muted-foreground/40 cursor-not-allowed"
                    )}
                    title={`${kudosRemaining}/2 kudos jäljellä tässä kuussa`}
                  >
                    <Award
                      size={15}
                      fill={hasGivenKudos ? "currentColor" : "none"}
                      className={cn(hasGivenKudos && "animate-scale-in")}
                    />
                    {(post.kudos_count || 0) > 0 && (post.kudos_count || 0)}
                  </button>
                )}

                {/* Show kudos count for own posts */}
                {isOwn && (post.kudos_count || 0) > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[hsl(var(--purple))]">
                    <Award size={15} fill="currentColor" />
                    {post.kudos_count}
                  </div>
                )}
              </div>

              {/* Comments Section */}
              {showComments === post.id && (
                <div className="border-t border-border/50 px-4 py-3 space-y-3 bg-secondary/20">
                  {comments?.length === 0 && (
                    <p className="text-xs text-muted-foreground/60 text-center py-2">No comments yet</p>
                  )}
                  {comments?.map((comment: any) => (
                    <div key={comment.id} className="flex gap-2.5">
                      <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {comment.profile?.username?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="bg-secondary/80 rounded-2xl rounded-tl-sm px-3 py-1.5 max-w-[85%]">
                        <span className="text-[11px] font-bold text-gold">@{comment.profile?.username || "anon"}</span>
                        <p className="text-xs text-foreground/90 leading-relaxed">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                  {user && (
                    <div className="flex gap-2 pt-1">
                      <input
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        maxLength={300}
                        className="flex-1 h-8 px-3 rounded-full border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/30 transition-shadow"
                        onKeyDown={(e) => e.key === "Enter" && addComment.mutate()}
                      />
                      <button
                        onClick={() => addComment.mutate()}
                        disabled={!commentText.trim()}
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-95",
                          commentText.trim() ? "gradient-gold text-primary-foreground" : "bg-secondary text-muted-foreground"
                        )}
                      >
                        <Send size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EliteFeed;
