import { memo, useState } from "react";
import { Reply, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { MAX_VISUAL_DEPTH, type CommentNode } from "@/lib/comment-tree";

export interface CommentThreadProps {
  node: CommentNode;
  currentUserId?: string;
  onReply: (id: string, username: string, snippet: string) => void;
  onEdit: (id: string, content: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onReport?: (commentId: string, authorId: string) => void;
}

const isEdited = (node: CommentNode) => {
  if (!node.updated_at || !node.created_at) return false;
  return new Date(node.updated_at).getTime() - new Date(node.created_at).getTime() > 1500;
};

/**
 * Recursive comment thread row. Memoized so a parent re-render (e.g. a sibling
 * post mutating) doesn't re-render every thread — only the branches whose props
 * actually change. Shared between the global feed and (potentially) tribe feeds.
 */
const CommentThread = memo(function CommentThread({
  node,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  editingId,
  setEditingId,
  onReport,
}: CommentThreadProps) {
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
              <p className="text-[9px] text-muted-foreground/75">
                {formatDistanceToNow(new Date(node.created_at), { addSuffix: true })}
              </p>
              {currentUserId && (
                <button
                  type="button"
                  onClick={() => {
                    hapticSelection();
                    onReply(node.id, username, node.content || "");
                  }}
                  className="flex items-center gap-1 px-2 -mx-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 hover:text-gold transition-colors"
                >
                  <Reply aria-hidden size={10} />
                  Reply
                </button>
              )}
              {!isOwn && onReport && (
                <button
                  type="button"
                  onClick={() => onReport(node.id, node.user_id)}
                  className="flex items-center gap-1 px-2 -mx-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 hover:text-destructive transition-colors"
                >
                  <Flag size={10} aria-hidden /> Report
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
                    className="flex items-center gap-1 px-2 -mx-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 hover:text-gold transition-colors"
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
                    className="flex items-center gap-1 px-2 -mx-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 hover:text-destructive transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
              {node.children.length > 0 && (
                <span className="text-[9px] text-muted-foreground/75 tabular-nums">
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
});

export default CommentThread;
