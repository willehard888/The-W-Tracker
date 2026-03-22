import { useAuth } from "@/contexts/AuthContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Flame, Heart, MessageCircle, Send, Image, Flag, Lock, Crown, MoreHorizontal, AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TIER_STYLES: Record<string, string> = {
  elite: "bg-gradient-to-br from-gold to-amber-600",
  high_performer: "bg-gradient-to-br from-purple-500 to-indigo-600",
  rising: "bg-gradient-to-br from-sky-400 to-blue-600",
  normal: "bg-secondary",
};

const EliteFeed = () => {
  const { user, profile } = useAuth();
  const { isElite } = useRevenueCat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState("");
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["feed-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("feed_posts")
        .select("*")
        .eq("reported", false)
        .order("created_at", { ascending: false })
        .limit(50);
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
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        await supabase.storage.from("feed-images").upload(path, imageFile);
        const { data: urlData } = supabase.storage.from("feed-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
      await supabase.from("feed_posts").insert({
        user_id: user.id,
        content: newPost || null,
        image_url,
      });
    },
    onSuccess: () => {
      setNewPost("");
      setImageFile(null);
      setImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("Posted! 🔥");
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
      // Also flag the post
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const canPost = isElite;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <div className="animate-reveal mb-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-gold flex items-center justify-center">
            <Flame size={16} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight leading-none">Elite Feed</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">Discipline proof from top performers</p>
          </div>
        </div>
      </div>

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

          {/* Image Preview */}
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

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                <Image size={14} />
                Photo
              </button>
            </div>
            <Button
              variant="gold"
              size="sm"
              onClick={() => createPost.mutate()}
              disabled={createPost.isPending || (!newPost.trim() && !imageFile)}
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

          return (
            <div
              key={post.id}
              className={cn(
                "rounded-2xl border bg-card overflow-hidden transition-all card-depth",
                "hover:shadow-[0_8px_32px_hsl(0_0%_0%/0.35),0_4px_12px_hsl(var(--gold)/0.06)]",
                liked ? "border-gold/20" : "border-border"
              )}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Post Header */}
              <div className="flex items-center gap-3 p-4 pb-0">
                <Avatar className={cn("h-10 w-10 shrink-0 ring-2", post.profile?.status_tier === "elite" ? "ring-gold/40" : "ring-border/30")}>
                  {post.profile?.avatar_url ? <AvatarImage src={post.profile.avatar_url} alt={post.profile.username} /> : null}
                  <AvatarFallback className={cn("text-xs font-black text-white", tierStyle)}>
                    {post.profile?.username?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn("text-sm font-bold truncate", isOwn && "text-gold")}>@{post.profile?.username || "unknown"} {isOwn && <span className="text-[10px] text-gold/70 font-medium">(you)</span>}</p>
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

                {/* Post menu (report/delete) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground/60 hover:text-muted-foreground">
                      <MoreHorizontal size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    {isOwn ? (
                      <DropdownMenuItem
                        onClick={() => deletePost.mutate(post.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete post
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => reportPost.mutate(post.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <AlertTriangle size={14} className="mr-2" />
                        Report post
                      </DropdownMenuItem>
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
                  <img
                    src={post.image_url}
                    alt=""
                    className="w-full max-h-96 object-cover transition-transform"
                    loading="lazy"
                  />
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
