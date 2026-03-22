import { useAuth } from "@/contexts/AuthContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Flame, Heart, MessageCircle, Send, Image, Flag, Lock, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

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
      // Fetch profiles for posts
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier")
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
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
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
    },
  });

  const canPost = isElite;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <div className="animate-reveal mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Elite Feed</h1>
        <p className="text-xs text-muted-foreground mt-1">Discipline proof from the top performers.</p>
      </div>

      {/* Create Post (Elite Only) */}
      {canPost && (
        <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-gold/20 bg-card p-4 mb-6">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Share your discipline proof..."
            rows={3}
            maxLength={500}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              <button onClick={() => fileRef.current?.click()} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                <Image size={18} />
              </button>
              {imageFile && <span className="text-xs text-gold">{imageFile.name}</span>}
            </div>
            <Button
              variant="gold"
              size="sm"
              onClick={() => createPost.mutate()}
              disabled={createPost.isPending || (!newPost.trim() && !imageFile)}
            >
              <Send size={14} />
              Post
            </Button>
          </div>
        </div>
      )}

      {!canPost && user && (
        <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-border bg-card p-6 text-center mb-6">
          <Lock size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold">Elite members can post to the feed</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Upgrade to share your discipline proof</p>
          <Button variant="gold" size="sm" onClick={() => navigate("/paywall")}>
            <Crown size={14} />
            Unlock Elite
          </Button>
        </div>
      )}

      {/* Posts */}
      <div className="space-y-4 animate-reveal animate-reveal-delay-2">
        {isLoading && (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading feed...</div>
        )}
        {posts?.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Flame size={32} className="text-gold/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No posts yet. Be the first to share.</p>
          </div>
        )}
        {posts?.map((post: any) => (
          <div key={post.id} className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Post Header */}
            <div className="flex items-center gap-3 p-4 pb-2">
              <div className="h-9 w-9 rounded-full gradient-gold flex items-center justify-center text-xs font-black text-primary-foreground">
                {post.profile?.username?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">@{post.profile?.username || "unknown"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
                <Flag size={14} />
              </button>
            </div>

            {/* Content */}
            {post.content && <p className="px-4 text-sm leading-relaxed">{post.content}</p>}

            {/* Image */}
            {post.image_url && (
              <div className="mt-2">
                <img src={post.image_url} alt="" className="w-full max-h-80 object-cover" />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 px-4 py-3">
              <button
                onClick={() => toggleReaction.mutate(post.id)}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-colors",
                  reactions?.includes(post.id) ? "text-gold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Heart size={16} fill={reactions?.includes(post.id) ? "currentColor" : "none"} />
                {post.likes_count}
              </button>
              <button
                onClick={() => setShowComments(showComments === post.id ? null : post.id)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageCircle size={16} />
                {post.comments_count}
              </button>
            </div>

            {/* Comments Section */}
            {showComments === post.id && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                {comments?.map((comment: any) => (
                  <div key={comment.id} className="flex gap-2">
                    <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {comment.profile?.username?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-xs">
                        <span className="font-semibold text-gold">@{comment.profile?.username || "anon"}</span>{" "}
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}
                {user && (
                  <div className="flex gap-2">
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      maxLength={300}
                      className="flex-1 h-8 px-3 rounded-lg border border-border bg-secondary text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/40"
                      onKeyDown={(e) => e.key === "Enter" && addComment.mutate()}
                    />
                    <button
                      onClick={() => addComment.mutate()}
                      className="text-gold hover:text-gold-light transition-colors"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EliteFeed;
