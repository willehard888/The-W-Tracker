import { memo } from "react";
import {
  Flame, Heart, MessageCircle, Send, Crown, MoreHorizontal,
  AlertTriangle, Trash2, ShieldCheck, Award, Reply, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import StatusAvatar from "@/components/StatusAvatar";
import TierUsername from "@/components/TierUsername";
import StreakFlameInline from "@/components/StreakFlameInline";
import PostMedia from "@/components/feed/PostMedia";
import CommentThread from "@/components/feed/CommentThread";
import type { CommentNode } from "@/lib/comment-tree";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const isUnsupportedHeic = (value: string) => /\.hei(c|f)$/i.test(value);

type ReplyTarget = { id: string; username: string; snippet: string } | null;

export interface FeedPostCardProps {
  post: any;
  index: number;
  currentUserId?: string;
  isAdmin: boolean;
  canPost: boolean;
  liked: boolean;
  hasGivenKudos: boolean;
  verified: boolean;
  /** Day stats for check-in proof photos (premium sticker overlay). */
  dayStats?: import("@/components/feed/DayStatsSticker").DayStats | null;
  kudosRemaining: number;
  kudosPerMonth: number;

  // Comments
  isCommentsOpen: boolean;
  commentTree: CommentNode[];
  editingCommentId: string | null;
  setEditingCommentId: (id: string | null) => void;
  replyTo: ReplyTarget;
  setReplyTo: (r: ReplyTarget) => void;
  commentText: string;
  setCommentText: (s: string) => void;
  commentInputRef: React.RefObject<HTMLInputElement>;
  composerInitial: string;
  onReply: (id: string, username: string, snippet: string) => void;
  onEdit: (id: string, content: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onSubmitComment: () => void;
  addCommentPending: boolean;

  // Post actions
  onNavigateUser: (userId: string) => void;
  onToggleReaction: (postId: string) => void;
  onToggleComments: (postId: string) => void;
  onGiveKudos: (postId: string, receiverId: string) => void;
  onDeletePost: (postId: string) => void;
  onReportPost: (postId: string) => void;
  onAdminDelete: (postId: string) => void;
  onUnreport: (postId: string) => void;
  onOpenLightbox: (post: any) => void;
  giveKudosPending: boolean;
}

/**
 * A single feed post: header, content, media, action bar, and (when open) its
 * comment thread + composer. Extracted from EliteFeed.tsx and memoized so a
 * keystroke in one post's composer (or a sibling post mutating) no longer
 * re-renders every post in the feed.
 */
const FeedPostCard = memo(function FeedPostCard({
  post,
  index,
  currentUserId,
  isAdmin,
  canPost,
  liked,
  hasGivenKudos,
  verified,
  dayStats,
  kudosRemaining,
  kudosPerMonth,
  isCommentsOpen,
  commentTree,
  editingCommentId,
  setEditingCommentId,
  replyTo,
  setReplyTo,
  commentText,
  setCommentText,
  commentInputRef,
  composerInitial,
  onReply,
  onEdit,
  onDelete,
  onSubmitComment,
  addCommentPending,
  onNavigateUser,
  onToggleReaction,
  onToggleComments,
  onGiveKudos,
  onDeletePost,
  onReportPost,
  onAdminDelete,
  onUnreport,
  onOpenLightbox,
  giveKudosPending,
}: FeedPostCardProps) {
  const isOwn = post.user_id === currentUserId;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card overflow-hidden transition-all card-depth",
        "hover:shadow-[0_8px_32px_hsl(0_0%_0%/0.35),0_4px_12px_hsl(var(--gold)/0.06)]",
        post.reported ? "border-destructive/30 bg-destructive/[0.02]" : liked ? "border-gold/20" : "border-border"
      )}
      style={{
        animationDelay: `${index * 60}ms`,
        // Skip layout/paint for off-screen posts (cheap virtualization
        // without restructuring the scroll container). First few stay
        // eager so the initial paint isn't blank.
        contentVisibility: index < 4 ? undefined : "auto",
        containIntrinsicSize: index < 4 ? undefined : "auto 480px",
      }}
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
              onClick={() => onUnreport(post.id)}
              className="px-2 py-1 rounded text-[10px] font-bold bg-[hsl(var(--xp-green))]/15 text-[hsl(var(--xp-green))] hover:bg-[hsl(var(--xp-green))]/25 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onAdminDelete(post.id)}
              className="px-2 py-1 rounded text-[10px] font-bold bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Post Header */}
      <div className="flex items-center gap-3 p-4 pb-0">
        <StatusAvatar src={post.profile?.avatar_url} name={post.profile?.username} tier={post.profile?.status_tier || 'recruit'} size="sm" animated={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onNavigateUser(post.user_id)}
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
            {verified && (
              <span title="HealthKit-verified" className="inline-flex items-center gap-0.5 shrink-0">
                <ShieldCheck size={12} className="text-[hsl(var(--xp-green))]" />
              </span>
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
            <button aria-label="Post options" className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground/60 hover:text-muted-foreground">
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            {isOwn && (
              <DropdownMenuItem
                onClick={() => onDeletePost(post.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={14} className="mr-2" />
                Delete post
              </DropdownMenuItem>
            )}
            {!isOwn && (
              <DropdownMenuItem
                onClick={() => onReportPost(post.id)}
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
                  onClick={() => onAdminDelete(post.id)}
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
        <PostMedia
          imageUrl={post.image_url}
          alt={post.content || "Post image"}
          tier={post.profile?.status_tier}
          dayStats={dayStats}
          onOpenImage={() => onOpenLightbox(post)}
        />
      )}

      {/* Video */}
      {post.video_url && <PostMedia videoUrl={post.video_url} />}

      {/* Actions — themed for ranking system */}
      <div className="flex items-center gap-1 px-3 py-2.5 mt-1 border-t border-border/40">
        <button
          onClick={() => onToggleReaction(post.id)}
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
          onClick={() => onToggleComments(post.id)}
          aria-label="Toggle comments"
          className={cn(
            "flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold transition-all active:scale-95",
            isCommentsOpen
              ? "bg-gold/10 text-gold"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <MessageCircle size={15} fill={isCommentsOpen ? "currentColor" : "none"} />
          <span className="tabular-nums">{post.comments_count > 0 ? post.comments_count : ""}</span>
        </button>

        {/* Kudos button — only for non-own posts, members with earned Elite status */}
        {!isOwn && canPost && (
          <button
            onClick={() => {
              if (!hasGivenKudos && kudosRemaining <= 0) {
                toast.error("You've used all your kudos this month");
                return;
              }
              hapticImpact("medium");
              onGiveKudos(post.id, post.user_id);
            }}
            disabled={giveKudosPending}
            aria-label={hasGivenKudos ? "Remove kudos" : "Give kudos"}
            className={cn(
              "flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold transition-all active:scale-95",
              hasGivenKudos
                ? "bg-purple/15 text-purple ring-1 ring-purple/30"
                : kudosRemaining > 0
                  ? "text-muted-foreground hover:bg-purple/10 hover:text-purple"
                  : "text-muted-foreground/40 cursor-not-allowed"
            )}
            title={`${kudosRemaining}/${kudosPerMonth} kudos remaining this month`}
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
      {isCommentsOpen && (
        <div className="border-t border-border/50 px-4 py-3 bg-secondary/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Discussion
            </p>
            <p className="text-[10px] text-muted-foreground/60 tabular-nums">
              {post.comments_count || 0} {post.comments_count === 1 ? "reply" : "replies"}
            </p>
          </div>

          <div className="space-y-3 mb-3 max-h-80 overflow-y-auto pr-1">
            {commentTree.length === 0 && (
              <p className="text-xs text-muted-foreground/60 text-center py-3">
                No comments yet — start the conversation
              </p>
            )}
            {commentTree.map((node) => (
              <CommentThread
                key={node.id}
                node={node}
                currentUserId={currentUserId}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                editingId={editingCommentId}
                setEditingId={setEditingCommentId}
              />
            ))}
          </div>

          {/* Composer */}
          {currentUserId && (
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
                  {composerInitial}
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
                        onSubmitComment();
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
                  onClick={onSubmitComment}
                  disabled={!commentText.trim() || addCommentPending}
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
});

export default FeedPostCard;
