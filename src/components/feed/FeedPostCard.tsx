import { fmtRelative } from "@/lib/format";
import { memo } from "react";
import {
  Flame, MessageCircle, Send, Crown, MoreHorizontal,
  AlertTriangle, Trash2, ShieldCheck, Award, Reply, X,
} from "lucide-react";
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
  onReportComment?: (commentId: string, authorId: string) => void;
  onAdminDelete: (postId: string) => void;
  onUnreport: (postId: string) => void;
  onOpenLightbox: (post: any) => void;
  giveKudosPending: boolean;
}

/**
 * A single feed entry: author, caption, media, action bar, and (when open)
 * its comment thread + composer. Memoized so a keystroke in one post's
 * composer (or a sibling post mutating) never re-renders the rest.
 *
 * Deliberately NOT a boxed card. The feed is proof, and the proof is the
 * photo — so the entry sits on the ground with a hairline between neighbours
 * (the list's divide-y) and lets the media frame itself. The boxed version
 * stacked one more identical silhouette under the composer and made every
 * post read as a widget instead of a moment.
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
  onReportComment,
  onAdminDelete,
  onUnreport,
  onOpenLightbox,
  giveKudosPending,
}: FeedPostCardProps) {
  const isOwn = post.user_id === currentUserId;

  return (
    <article
      className={cn(
        "relative py-5 first:pt-1",
        post.reported && "rounded-2xl bg-destructive/[0.03] -mx-2 px-2",
        // The cascade continues from the header/composer rise above — only
        // the first screenful staggers; below the fold nobody is watching,
        // and delaying content the user scrolled to would feel slower.
        index < 6 && "animate-fade-in-up",
      )}
      style={{
        animationDelay: `${160 + Math.min(index, 6) * 45}ms`,
        // Skip layout/paint for off-screen posts (cheap virtualization
        // without restructuring the scroll container). First few stay
        // eager so the initial paint isn't blank.
        contentVisibility: index < 4 ? undefined : "auto",
        containIntrinsicSize: index < 4 ? undefined : "auto 480px",
      }}
    >
      {/* Reported — admin triage row */}
      {post.reported && isAdmin && (
        <div className="flex items-center justify-between mb-3 px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-1.5">
            <AlertTriangle aria-hidden size={12} className="text-destructive" />
            <span className="eyebrow text-destructive">Reported</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUnreport(post.id)}
              className="px-2 py-1 rounded text-[11px] font-bold bg-[hsl(var(--xp-green))]/15 text-[hsl(var(--xp-green))] hover:bg-[hsl(var(--xp-green))]/25 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onAdminDelete(post.id)}
              className="px-2 py-1 rounded text-[11px] font-bold bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Author */}
      <div className="flex items-center gap-3">
        <StatusAvatar src={post.profile?.avatar_url} name={post.profile?.username} tier={post.profile?.status_tier || 'recruit'} size="sm" animated={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onNavigateUser(post.user_id)}
              className="text-[14px] font-bold truncate hover:underline"
            >
              <TierUsername
                username={post.profile?.username}
                tier={post.profile?.status_tier || "recruit"}
              />
              {isOwn && <span className="ml-1 text-[11px] text-gold/70 font-medium">(you)</span>}
            </button>
            {post.profile?.status_tier === "elite" && (
              <Crown size={12} role="img" aria-label="Elite tier" className="text-gold shrink-0" />
            )}
            {verified && (
              <span role="img" aria-label="HealthKit-verified" className="inline-flex items-center gap-0.5 shrink-0">
                <ShieldCheck aria-hidden size={12} className="text-[hsl(var(--xp-green))]" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{fmtRelative(post.created_at)}</span>
            {/* Author-only: server moderation hasn't approved yet (others can't
                see the post until it does — usually seconds). */}
            {post.moderation_status === "pending" && (
              <span className="inline-flex items-center px-1.5 py-px rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-400 font-bold uppercase tracking-wider">
                Reviewing…
              </span>
            )}
            {post.profile?.streak > 0 && (
              <>
                <span>•</span>
                <StreakFlameInline streak={post.profile.streak} suffix="d" className="text-[11px]" />
              </>
            )}
          </div>
        </div>

        {/* Post menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Post options" className="h-11 w-11 -mr-2 flex items-center justify-center rounded-full hover:bg-secondary transition-colors text-muted-foreground/75 hover:text-muted-foreground">
              <MoreHorizontal aria-hidden size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            {isOwn && (
              <DropdownMenuItem
                onClick={() => onDeletePost(post.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 aria-hidden size={14} className="mr-2" />
                Delete post
              </DropdownMenuItem>
            )}
            {!isOwn && (
              <DropdownMenuItem
                onClick={() => onReportPost(post.id)}
                className="text-destructive focus:text-destructive"
              >
                <AlertTriangle aria-hidden size={14} className="mr-2" />
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
                  <ShieldCheck aria-hidden size={14} className="mr-2" />
                  Admin: Remove
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Caption — reading size; a proof caption is copy, not metadata */}
      {post.content && (
        <p className="mt-2.5 text-[15px] leading-relaxed overflow-wrap-break-word">{post.content}</p>
      )}

      {/* Media — the shared frame, full column width (no card gutter left) */}
      {post.image_url && (
        <PostMedia
          imageUrl={post.image_url}
          alt={post.content || "Post image"}
          tier={post.profile?.status_tier}
          dayStats={dayStats}
          onOpenImage={() => onOpenLightbox(post)}
          className="mx-0 mt-3 rounded-[20px]"
        />
      )}
      {post.video_url && <PostMedia videoUrl={post.video_url} className="mx-0 mt-3 rounded-[20px]" />}

      {/* Actions — pills hang off the text edge; a landed reaction gets the
          app's shared commit-pop, the same "your choice landed" spring as a
          habit tick, so recognition here feels like the rest of the app. */}
      <div className="flex items-center gap-0.5 mt-1.5 -ml-3">
        <button
          onClick={() => onToggleReaction(post.id)}
          aria-label={liked ? "Remove fire" : "Give fire"}
          className={cn(
            "press flex items-center gap-1.5 px-3 h-11 min-w-11 justify-center rounded-full text-xs font-bold transition-all ",
            liked
              ? "bg-streak-orange/15 text-streak-orange commit-pop"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Flame aria-hidden size={15} fill={liked ? "currentColor" : "none"} />
          <span className="tabular-nums">{post.likes_count > 0 ? post.likes_count : ""}</span>
        </button>
        <button
          onClick={() => onToggleComments(post.id)}
          aria-label="Toggle comments"
          className={cn(
            "press flex items-center gap-1.5 px-3 h-11 min-w-11 justify-center rounded-full text-xs font-bold transition-all ",
            isCommentsOpen
              ? "bg-gold/10 text-gold"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <MessageCircle aria-hidden size={15} fill={isCommentsOpen ? "currentColor" : "none"} />
          <span className="tabular-nums">{post.comments_count > 0 ? post.comments_count : ""}</span>
        </button>

        {/* Kudos — the scarce recognition, non-own posts only */}
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
              "flex items-center gap-1.5 px-3 h-11 min-w-11 justify-center rounded-full text-xs font-bold transition-all ",
              hasGivenKudos
                ? "bg-purple/15 text-purple ring-1 ring-purple/30 commit-pop"
                : kudosRemaining > 0
                  ? "text-muted-foreground hover:bg-purple/10 hover:text-purple"
                  : "text-muted-foreground/75 cursor-not-allowed"
            )}
            title={`${kudosRemaining}/${kudosPerMonth} kudos remaining this month`}
          >
            <Award aria-hidden size={15} fill={hasGivenKudos ? "currentColor" : "none"} />
            <span className="tabular-nums">{(post.kudos_count || 0) > 0 ? post.kudos_count : ""}</span>
          </button>
        )}

        {/* Kudos count on own posts */}
        {isOwn && (post.kudos_count || 0) > 0 && (
          <div className="flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold text-purple bg-purple/10">
            <Award aria-hidden size={15} fill="currentColor" />
            <span className="tabular-nums">{post.kudos_count}</span>
          </div>
        )}
      </div>

      {/* Discussion — a soft well under the entry, the one real container */}
      {isCommentsOpen && (
        <div className="mt-2 rounded-2xl bg-secondary/25 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="eyebrow text-muted-foreground">
              Discussion
            </p>
            <p className="text-[11px] text-muted-foreground/75 tabular-nums">
              {post.comments_count || 0} {post.comments_count === 1 ? "reply" : "replies"}
            </p>
          </div>

          <div className="space-y-3 mb-3 max-h-80 overflow-y-auto pr-1">
            {commentTree.length === 0 && (
              <p className="text-xs text-muted-foreground/75 text-center py-3">
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
                onReport={onReportComment}
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
                    <div className="eyebrow flex items-center gap-1 text-gold">
                      <Reply aria-hidden size={12} />
                      Replying to @{replyTo.username}
                    </div>
                    <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5 break-words">
                      {replyTo.snippet || "(no text)"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { hapticSelection(); setReplyTo(null); }}
                    aria-label="Cancel reply"
                    className="relative self-start h-6 w-6 rounded-full bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0 before:absolute before:-inset-2.5 before:content-['']"
                  >
                    <X aria-hidden size={12} />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="h-8 w-8 rounded-full gradient-gold flex items-center justify-center text-[11px] font-black text-primary-foreground shrink-0">
                  {composerInitial}
                </div>
                <div className="flex-1 min-w-0 relative">
                  <input
                    ref={commentInputRef}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={replyTo ? `Reply to @${replyTo.username}…` : "Add a comment…"}
                    aria-label={replyTo ? `Reply to @${replyTo.username}` : "Add a comment"}
                    maxLength={300}
                    className={cn(
                      "w-full h-9 pl-3 pr-12 rounded-full border bg-background text-xs text-foreground placeholder:text-muted-foreground/75 focus:outline-none focus:ring-2 transition-all",
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
                        "absolute right-12 top-1/2 -translate-y-1/2 text-[10px] font-semibold tabular-nums",
                        commentText.length > 270 ? "text-destructive" : "text-muted-foreground/75"
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
                    "h-9 w-9 rounded-full flex items-center justify-center transition-all shrink-0",
                    commentText.trim()
                      ? "gradient-gold text-primary-foreground glow-gold"
                      : "bg-secondary text-muted-foreground/75 cursor-not-allowed"
                  )}
                >
                  <Send aria-hidden size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
});

export default FeedPostCard;
