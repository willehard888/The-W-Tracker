
import { useAuth } from "@/contexts/AuthContext";
import StreakFlameInline from "@/components/StreakFlameInline";
import LazyVideoPlayer from "@/components/LazyVideoPlayer";
import EmptyState from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useBlockActions } from "@/hooks/use-blocking";
import { useState, useRef, useMemo, useCallback, useEffect } from "react";
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
import AppImage from "@/components/ui/app-image";
import FeedPostCard from "@/components/feed/FeedPostCard";
import { buildCommentTree } from "@/lib/comment-tree";
import { downscaleImage } from "@/lib/downscale-image";
import { fetchFeedPosts } from "@/lib/feed-query";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import MediaPreview from "@/components/media/MediaPreview";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const SUPPORTED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
const MAX_IMAGE_SIZE_MB = 8;
const MAX_VIDEO_SIZE_MB = 50;

const isUnsupportedHeic = (value: string) => /\.hei(c|f)$/i.test(value);
const isVideoUrl = (url: string) => SUPPORTED_VIDEO_EXTENSIONS.some(ext => url.toLowerCase().includes(ext));

// Stable empty reference so closed posts always receive the same `commentTree`
// prop — keeps FeedPostCard's memo intact (a fresh [] would re-render every card).
const EMPTY_TREE: any[] = [];

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
  // Revoke the previous video blob URL whenever the preview changes or the
  // page unmounts — WKWebView otherwise holds every tried clip in memory.
  useEffect(() => {
    const url = videoPreview;
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [videoPreview]);

  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [showReported, setShowReported] = useState(false);
  const [showReportsPanel, setShowReportsPanel] = useState(false);
  const [lightboxPost, setLightboxPost] = useState<any | null>(null);

  // Pull-to-refresh
  const { scrollRef, pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd, PULL_THRESHOLD } = usePullRefresh([["feed-posts"], ["feed-user-interactions"], ["feed-comments"]]);
  const moderation = useModeration();

  // Check if current user is admin (shared cache across the app)
  const isAdmin = useIsAdmin(user?.id);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["feed-posts", showReported],
    placeholderData: keepPreviousData,
    // Shared with the app-shell prefetcher (FeedPrefetcher in App.tsx) —
    // by the time the user taps Squad this is usually already in cache.
    queryFn: () => fetchFeedPosts(showReported),
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
  // Combine 3 separate kudos/reactions queries into one parallel fetch to
  // halve the number of round-trips on initial feed load.
  const { data: userInteractions } = useQuery({
    queryKey: ["feed-user-interactions", user?.id],
    queryFn: async () => {
      if (!user) return { kudosPosts: [] as string[], kudosMonth: 0, reactionPosts: [] as string[] };
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [kudosAll, kudosMonth, reactionsRes] = await Promise.all([
        supabase.from("kudos").select("post_id").eq("giver_id", user.id),
        supabase.from("kudos").select("id", { count: "exact", head: true })
          .eq("giver_id", user.id).gte("created_at", startOfMonth),
        supabase.from("feed_reactions").select("post_id").eq("user_id", user.id),
      ]);

      return {
        kudosPosts: kudosAll.data?.map((k: any) => k.post_id) ?? [],
        kudosMonth: kudosMonth.count ?? 0,
        reactionPosts: reactionsRes.data?.map((r) => r.post_id) ?? [],
      };
    },
    enabled: !!user,
  });

  // Use Sets for O(1) per-post lookups instead of O(n) array.includes()
  const userKudosPosts = useMemo(
    () => new Set(userInteractions?.kudosPosts ?? []),
    [userInteractions?.kudosPosts],
  );
  const kudosGivenThisMonth = userInteractions?.kudosMonth ?? 0;
  const reactions = useMemo(
    () => new Set(userInteractions?.reactionPosts ?? []),
    [userInteractions?.reactionPosts],
  );
  // Kudos = the premium, scarce recognition (fire/Heart is the unlimited like).
  // 2/month was too tight to feel alive; 10 keeps it meaningful but usable.
  // 2/month, matching the tribe feed and enforced server-side in the kudos
  // RLS policy (kudos award +10 XP — the cap prevents collusion farming).
  const KUDOS_PER_MONTH = 2;
  const kudosRemaining = Math.max(0, KUDOS_PER_MONTH - kudosGivenThisMonth);

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
        // Shrink before upload so we don't store/serve multi-MB originals.
        setUploadPhase("Optimizing…");
        const upload = await downscaleImage(imageFile, { maxDim: 2048, quality: 0.9 });
        const fileExt = upload.name.split(".").pop()?.toLowerCase() || "jpg";
        const safeExt = ["jpeg", "jpg", "png", "webp", "heic", "heif"].includes(fileExt) ? fileExt : "jpg";
        const path = `${user.id}/${Date.now()}.${safeExt}`;
        const contentType = upload.type || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`;
        setUploadPhase("Uploading…");
        const { error: uploadErr } = await supabase.storage.from("feed-images").upload(path, upload, {
          cacheControl: "3600",
          upsert: false,
          contentType,
        });
        if (uploadErr) throw new Error(`Image upload failed: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage.from("feed-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      if (videoFile) {
        setUploadPhase("Uploading…");
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

      const { error: insertErr } = await supabase.from("feed_posts").insert({
        user_id: user.id,
        content: newPost || null,
        image_url,
        video_url,
      });
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      setNewPost("");
      setImageFile(null);
      setImagePreview(null);
      setVideoFile(null);
      setVideoPreview(null);
      hapticNotification("success");
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("Posted! 🔥");
    },
    onSettled: () => setUploadPhase(null),
    onError: (error: any) => {
      toast.error(friendlyError(error, "Failed to create post. Try again."));
    },
  });

  // Query keys these mutations optimistically patch. Posts is keyed by
  // `showReported`, interactions by user id — keep them in sync here.
  const postsKey = ["feed-posts", showReported] as const;
  const interactionsKey = ["feed-user-interactions", user?.id] as const;

  // Mutate the cached post array in place (immutably) for instant count UI.
  const patchPostInCache = (postId: string, patch: (p: any) => any) => {
    queryClient.setQueryData<any[]>(postsKey, (old) =>
      old?.map((p) => (p.id === postId ? patch(p) : p)),
    );
  };

  const toggleReaction = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) return;
      const liked = reactions?.has(postId);
      hapticImpact(liked ? "light" : "medium");
      const { error } = liked
        ? await supabase.from("feed_reactions").delete().eq("post_id", postId).eq("user_id", user.id)
        : await supabase.from("feed_reactions").insert({ post_id: postId, user_id: user.id });
      if (error) throw error;
    },
    onMutate: async (postId: string) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: interactionsKey }),
        queryClient.cancelQueries({ queryKey: postsKey }),
      ]);
      const prevInteractions = queryClient.getQueryData<any>(interactionsKey);
      const prevPosts = queryClient.getQueryData<any[]>(postsKey);
      const wasLiked = reactions?.has(postId);

      queryClient.setQueryData<any>(interactionsKey, (old: any) => {
        if (!old) return old;
        const set = new Set<string>(old.reactionPosts ?? []);
        if (wasLiked) set.delete(postId);
        else set.add(postId);
        return { ...old, reactionPosts: [...set] };
      });
      patchPostInCache(postId, (p) => ({
        ...p,
        likes_count: Math.max(0, (p.likes_count || 0) + (wasLiked ? -1 : 1)),
      }));

      return { prevInteractions, prevPosts };
    },
    onError: (_err, _postId, context) => {
      if (context?.prevInteractions !== undefined) queryClient.setQueryData(interactionsKey, context.prevInteractions);
      if (context?.prevPosts !== undefined) queryClient.setQueryData(postsKey, context.prevPosts);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-user-interactions"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    },
  });

  const giveKudos = useMutation({
    mutationFn: async ({ postId, receiverId }: { postId: string; receiverId: string }) => {
      if (!user || !canPost) return;
      const alreadyGiven = userKudosPosts?.has(postId);
      if (!alreadyGiven && kudosRemaining <= 0) {
        throw new Error("Monthly kudos used up");
      }
      const { error } = alreadyGiven
        ? await supabase.from("kudos").delete().eq("post_id", postId).eq("giver_id", user.id)
        : await supabase.from("kudos").insert({
            giver_id: user.id,
            post_id: postId,
            receiver_id: receiverId,
          });
      if (error) throw error;
    },
    onMutate: async ({ postId }: { postId: string; receiverId: string }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: interactionsKey }),
        queryClient.cancelQueries({ queryKey: postsKey }),
      ]);
      const prevInteractions = queryClient.getQueryData<any>(interactionsKey);
      const prevPosts = queryClient.getQueryData<any[]>(postsKey);
      const alreadyGiven = userKudosPosts?.has(postId);
      // Don't optimistically apply a give that will be rejected for quota.
      if (!alreadyGiven && kudosRemaining <= 0) return { prevInteractions, prevPosts };

      queryClient.setQueryData<any>(interactionsKey, (old: any) => {
        if (!old) return old;
        const set = new Set<string>(old.kudosPosts ?? []);
        if (alreadyGiven) set.delete(postId);
        else set.add(postId);
        return {
          ...old,
          kudosPosts: [...set],
          kudosMonth: Math.max(0, (old.kudosMonth || 0) + (alreadyGiven ? -1 : 1)),
        };
      });
      patchPostInCache(postId, (p) => ({
        ...p,
        kudos_count: Math.max(0, (p.kudos_count || 0) + (alreadyGiven ? -1 : 1)),
      }));

      return { prevInteractions, prevPosts };
    },
    onError: (error: any, _vars, context) => {
      if (context?.prevInteractions !== undefined) queryClient.setQueryData(interactionsKey, context.prevInteractions);
      if (context?.prevPosts !== undefined) queryClient.setQueryData(postsKey, context.prevPosts);
      toast.error(friendlyError(error, "Kudos failed"));
    },
    onSuccess: () => {
      toast.success("Kudos! 🏆");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-user-interactions"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
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
      const { error } = await supabase.from("feed_comments").insert({
        post_id: showComments,
        user_id: user.id,
        content: commentText.trim(),
        parent_id: replyTo?.id ?? null,
      });
      if (error) throw error;
    },
    onMutate: async () => {
      if (!showComments) return {};
      const postId = showComments;
      await queryClient.cancelQueries({ queryKey: postsKey });
      const prevPosts = queryClient.getQueryData<any[]>(postsKey);
      // Instant reply-count bump; full comment list refetches on settle.
      patchPostInCache(postId, (p) => ({ ...p, comments_count: (p.comments_count || 0) + 1 }));
      return { prevPosts };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.prevPosts !== undefined) queryClient.setQueryData(postsKey, context.prevPosts);
      toast.error("Failed to post comment. Try again.");
    },
    onSuccess: () => {
      setCommentText("");
      setReplyTo(null);
    },
    onSettled: () => {
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
    onError: (e: any) => toast.error(friendlyError(e, "Could not update. Try again.")),
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
    onError: (e: any) => toast.error(friendlyError(e, "Could not delete. Try again.")),
  });

  // Memoize comment tree — avoids rebuilding the entire tree on every render.
  // Rebuilt only when the comments data actually changes.
  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  // Stable callbacks for CommentThread — prevents child re-renders from
  // new inline arrow functions being created on each parent render.
  const handleCommentReply = useCallback((id: string, username: string, snippet: string) => {
    setReplyTo({ id, username, snippet });
    setTimeout(() => commentInputRef.current?.focus(), 50);
  }, []);

  const handleCommentEdit = useCallback(async (id: string, content: string) => {
    await editComment.mutateAsync({ id, content });
  }, [editComment]);

  const handleCommentDelete = useCallback(async (id: string) => {
    await deleteComment.mutateAsync(id);
  }, [deleteComment]);

  const reportPost = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) return;
      const { error: reportErr } = await supabase.from("reports").insert({
        reporter_id: user.id,
        post_id: postId,
        reason: "Reported by user",
      });
      if (reportErr) throw reportErr;
      const { error: flagErr } = await supabase.from("feed_posts").update({ reported: true }).eq("id", postId);
      if (flagErr) throw flagErr;
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
      const { error } = await supabase.from("feed_posts").delete().eq("id", postId);
      if (error) throw error;
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
      const { error } = await supabase.from("feed_posts").delete().eq("id", postId).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    },
  });

  // Admin: unreport post
  const unreportPost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("feed_posts").update({ reported: false }).eq("id", postId);
      if (error) throw error;
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
      const { error } = await supabase.from("reports").update({ resolved: true }).eq("id", reportId);
      if (error) throw error;
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
    hapticSelection();
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
    hapticSelection();
    setImageFile(null);
    setImagePreview(null);
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  // B) Verified — which post authors have HealthKit-confirmed check-ins.
  //    (daily_checkins RLS blocks reading others' rows, so a SECURITY DEFINER
  //    RPC returns just the verified subset of the visible authors.)
  const verifiedAuthorIds = useMemo(
    () => Array.from(new Set((posts ?? []).map((p: any) => p.user_id))),
    [posts],
  );
  const { data: verifiedSet } = useQuery({
    queryKey: ["feed-verified-authors", verifiedAuthorIds],
    enabled: verifiedAuthorIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verified_authors", { p_ids: verifiedAuthorIds });
      if (error) return new Set<string>();
      return new Set((data as string[]) ?? []);
    },
  });

  // C) Day-stats stickers — check-in proof photos carry that DAY's stats as a
  //    premium overlay. Auto proof posts share their image_url byte-for-byte
  //    with daily_checkins.proof_photo_url, so the SECURITY DEFINER RPC joins
  //    on URL equality (which also naturally excludes composer posts — their
  //    feed-images URLs match nothing).
  const proofImageUrls = useMemo(
    () =>
      Array.from(
        new Set(
          (posts ?? [])
            .map((p: any) => p.image_url as string | null)
            .filter((u): u is string => !!u && u.includes("/proof-photos/")),
        ),
      ),
    [posts],
  );
  const { data: dayStatsMap } = useQuery({
    queryKey: ["feed-day-stats", proofImageUrls],
    enabled: proofImageUrls.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("feed_post_day_stats", {
        p_image_urls: proofImageUrls.slice(0, 60),
      });
      if (error)
        return new Map<
          string,
          { xp_earned: number; habits_done: number; verified: boolean; streak_at_day: number }
        >();
      return new Map(
        (
          (data ?? []) as Array<{
            image_url: string;
            xp_earned: number;
            habits_done: number;
            verified: boolean;
            streak_at_day: number;
          }>
        ).map((r) => [
          r.image_url,
          {
            xp_earned: r.xp_earned,
            habits_done: r.habits_done,
            verified: r.verified,
            streak_at_day: Number(r.streak_at_day) || 0,
          },
        ]),
      );
    },
  });

  // A) Social proof — how many showed up in the last 24h. Loss-aversion +
  //    momentum ("everyone's moving, add yours").
  const { data: todayWins } = useQuery({
    queryKey: ["feed-today-wins"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("daily_checkins")
        .select("id", { count: "exact", head: true })
        .gte("checked_in_at", since);
      return count ?? 0;
    },
  });

  // The app is a hard paywall — every member pays to be here, so every member
  // can post. (We used to gate posting to *earned* Elite, which silenced almost
  // everyone and left the community feed dead.) The author's tier still renders
  // on each post, so status is visible without locking people out of the loop.
  const userTier = profile?.status_tier || 'recruit';
  const tierRank = getTierConfig(userTier).rank;
  const canPost = !!user;
  const unresolvedReportsCount = reports?.length || 0;
  const canView = true; // any member that passes AccessGate can read the feed

  // Stable per-post action handlers (TanStack `.mutate` is referentially stable)
  // so FeedPostCard's memo holds — closed posts don't re-render on every keystroke
  // in another post's composer.
  const onNavigateUser = useCallback((id: string) => navigate(`/user/${id}`), [navigate]);
  const onToggleReaction = useCallback((id: string) => toggleReaction.mutate(id), [toggleReaction.mutate]);
  const onToggleComments = useCallback((id: string) => {
    hapticSelection();
    setReplyTo(null);
    setShowComments((prev) => (prev === id ? null : id));
  }, []);
  const onGiveKudos = useCallback(
    (id: string, rid: string) => giveKudos.mutate({ postId: id, receiverId: rid }),
    [giveKudos.mutate],
  );
  const onDeletePost = useCallback((id: string) => deletePost.mutate(id), [deletePost.mutate]);
  const onReportPost = useCallback((id: string) => reportPost.mutate(id), [reportPost.mutate]);
  const onAdminDelete = useCallback((id: string) => adminDeletePost.mutate(id), [adminDeletePost.mutate]);
  const onUnreport = useCallback((id: string) => unreportPost.mutate(id), [unreportPost.mutate]);
  const { report: reportContent } = useBlockActions();
  const onReportComment = useCallback((commentId: string, authorId: string) => reportContent("comment", commentId, authorId), [reportContent]);
  const onOpenLightbox = useCallback((p: any) => { hapticSelection(); setLightboxPost(p); }, []);
  const onSubmitComment = useCallback(() => { hapticImpact("light"); addComment.mutate(); }, [addComment.mutate]);
  const composerInitial = profile?.username?.charAt(0)?.toUpperCase() || "?";
  const giveKudosPending = giveKudos.isPending;

  return (
    <div
      ref={scrollRef}
      className="min-h-full pb-8 px-4 pt-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} threshold={PULL_THRESHOLD} />
      
      <div className="animate-reveal mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight leading-none my-[10px] py-[10px]">Elite Feed</h1>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
              Discipline proof from top performers
              {/* Kudos quota was invisible on touch (title attr only) — the
                  scarce mechanic is only fun if you can SEE the budget. */}
              {user && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 border border-gold/25 px-2 py-0.5 text-[11px] font-black text-gold tabular-nums">
                  <Award aria-hidden size={12} /> {kudosRemaining}/{KUDOS_PER_MONTH} kudos left this month
                </span>
              )}
            </p>
          </div>

          {/* Admin controls */}
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowReported(!showReported)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all",
                  showReported
                    ? "bg-destructive/15 text-destructive border border-destructive/30"
                    : "bg-secondary text-muted-foreground hover:text-foreground border border-border"
                )}
              >
                {showReported ? <EyeOff aria-hidden size={12} /> : <Eye aria-hidden size={12} />}
                {showReported ? "Hide flagged" : "Flagged"}
              </button>
              <button
                onClick={() => setShowReportsPanel(!showReportsPanel)}
                className={cn(
                  "relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all",
                  showReportsPanel
                    ? "bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))] border border-[hsl(var(--purple))]/30"
                    : "bg-secondary text-muted-foreground hover:text-foreground border border-border"
                )}
              >
                <ShieldCheck aria-hidden size={12} />
                Reports
                {unresolvedReportsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-black flex items-center justify-center">
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
        <div className="animate-reveal surface-card border-[hsl(var(--purple))]/30 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck aria-hidden size={16} className="text-[hsl(var(--purple))]" />
            <h2 className="font-display text-sm font-bold">Pending Reports</h2>
            <span className="text-[11px] text-muted-foreground">({unresolvedReportsCount})</span>
          </div>
          {unresolvedReportsCount === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No pending reports 🎉</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {reports?.map((report: any) => (
                <div key={report.id} className="rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-muted-foreground">
                        Reported by <span className="font-semibold text-foreground">@{report.reporter?.username || "unknown"}</span>
                        {" · "}
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{report.reason}</p>
                      {report.post && (
                        <div className="mt-2 rounded-lg border border-border/50 bg-card p-2">
                          <p className="text-xs text-foreground/80 line-clamp-2">{report.post.content || "(image only)"}</p>
                          {report.post.image_url && (
                            <AppImage src={report.post.image_url} width={96} alt="" className="mt-1 h-16 w-24 object-cover rounded" />
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
                        className="h-7 px-2.5 rounded-lg bg-[hsl(var(--xp-green))]/15 text-[hsl(var(--xp-green))] text-[11px] font-bold hover:bg-[hsl(var(--xp-green))]/25 transition-colors flex items-center gap-1"
                      >
                        <CheckCircle aria-hidden size={12} />
                        Keep
                      </button>
                      {/* Delete post */}
                      <button
                        onClick={async () => {
                          if (report.post_id) await adminDeletePost.mutateAsync(report.post_id);
                          resolveReport.mutate({ reportId: report.id, action: "delete" });
                        }}
                        className="h-7 px-2.5 rounded-lg bg-destructive/15 text-destructive text-[11px] font-bold hover:bg-destructive/25 transition-colors flex items-center gap-1"
                      >
                        <Trash2 aria-hidden size={12} />
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

      {/* A) Today's wins — social proof banner */}
      {(todayWins ?? 0) > 0 && (
        <div className="animate-reveal mb-4 rounded-2xl border border-[hsl(var(--streak-orange))]/30 bg-gradient-to-r from-[hsl(var(--streak-orange))]/[0.08] to-transparent px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[hsl(var(--streak-orange))]/15 flex items-center justify-center shrink-0">
            <Flame aria-hidden size={16} className="text-[hsl(var(--streak-orange))]" fill="currentColor" />
          </div>
          <p className="text-[13px] font-bold leading-snug text-foreground/90">
            <span className="text-[hsl(var(--streak-orange))] font-black tabular-nums">{todayWins}</span>{" "}
            {todayWins === 1 ? "operator" : "operators"} showed up in the last 24h.
            <span className="text-muted-foreground font-medium"> Add yours.</span>
          </p>
        </div>
      )}

      {/* Create Post */}
      {canPost && (
        <div className="animate-reveal animate-reveal-delay-1 surface-card border-gold/20 p-4 mb-6">
          <div className="flex gap-3">
            <div className="h-9 w-9 rounded-full gradient-gold flex items-center justify-center text-xs font-black text-primary-foreground shrink-0">
              {profile?.username?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Share your W today..."
              aria-label="Share your W today"
              rows={2}
              maxLength={500}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/75 resize-none focus:outline-none leading-relaxed"
            />
          </div>

          {imagePreview && (
            <MediaPreview
              imageSrc={imagePreview}
              sizeBytes={imageFile?.size}
              progressLabel={uploadPhase}
              onClear={() => { setImageFile(null); setImagePreview(null); }}
            />
          )}

          {videoPreview && (
            <MediaPreview
              videoSrc={videoPreview}
              sizeBytes={videoFile?.size}
              progressLabel={uploadPhase}
              onClear={() => { setVideoFile(null); setVideoPreview(null); }}
            />
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                <Image aria-hidden size={14} />
                Photo
              </button>
              <button
                onClick={() => videoRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                <Video aria-hidden size={14} />
                Video
              </button>
            </div>
            <Button
              variant="ember"
              size="sm"
              onClick={() => createPost.mutate()}
              disabled={createPost.isPending || (!newPost.trim() && !imageFile && !videoFile)}
              className="rounded-full px-5"
            >
              <Send aria-hidden size={12} />
              {createPost.isPending ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      )}

      {/* (The old "Posting is for the Elite tier" gate card was removed —
          canPost is !!user now, so the block was unreachable dead copy that
          contradicted the current model.) */}

      {/* Posts */}
      <div className="space-y-4 animate-reveal animate-reveal-delay-2">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="surface-card p-4 skeleton-block">
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
          <EmptyState
            icon={Flame}
            title="No posts yet"
            description="Be the first to share your W — the elite feed only counts proof."
          />
        )}

        {posts?.map((post: any, index: number) => {
          const isOpen = showComments === post.id;
          return (
            <FeedPostCard
              key={post.id}
              post={post}
              index={index}
              currentUserId={user?.id}
              isAdmin={!!isAdmin}
              canPost={canPost}
              liked={!!reactions?.has(post.id)}
              hasGivenKudos={!!userKudosPosts?.has(post.id)}
              verified={!!verifiedSet?.has(post.user_id)}
              dayStats={post.image_url ? dayStatsMap?.get(post.image_url) ?? null : null}
              kudosRemaining={kudosRemaining}
              kudosPerMonth={KUDOS_PER_MONTH}
              isCommentsOpen={isOpen}
              // Per-open-post composer props are gated to stable defaults when
              // closed, so a keystroke in the open post doesn't re-render the rest.
              commentTree={isOpen ? commentTree : EMPTY_TREE}
              editingCommentId={isOpen ? editingCommentId : null}
              setEditingCommentId={setEditingCommentId}
              replyTo={isOpen ? replyTo : null}
              setReplyTo={setReplyTo}
              commentText={isOpen ? commentText : ""}
              setCommentText={setCommentText}
              commentInputRef={commentInputRef}
              composerInitial={composerInitial}
              onReply={handleCommentReply}
              onEdit={handleCommentEdit}
              onDelete={handleCommentDelete}
              onSubmitComment={onSubmitComment}
              addCommentPending={isOpen ? addComment.isPending : false}
              onNavigateUser={onNavigateUser}
              onToggleReaction={onToggleReaction}
              onToggleComments={onToggleComments}
              onGiveKudos={onGiveKudos}
              onDeletePost={onDeletePost}
              onReportPost={onReportPost}
              onReportComment={onReportComment}
              onAdminDelete={onAdminDelete}
              onUnreport={onUnreport}
              onOpenLightbox={onOpenLightbox}
              giveKudosPending={giveKudosPending}
            />
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
