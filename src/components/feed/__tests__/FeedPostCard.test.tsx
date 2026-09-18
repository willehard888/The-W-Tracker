import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FeedPostCard, { type FeedPostCardProps } from "@/components/feed/FeedPostCard";

/** A delete is one tap from the menu; it must never land without a confirm. */

vi.mock("@/lib/haptics", () => ({ hapticImpact: vi.fn(), hapticSelection: vi.fn(), hapticNotification: vi.fn() }));
vi.mock("@/components/StatusAvatar", () => ({ default: () => null }));
vi.mock("@/components/TierUsername", () => ({ default: ({ username }: { username: string }) => <span>{username}</span> }));
vi.mock("@/components/StreakFlameInline", () => ({ default: () => null }));
vi.mock("@/components/feed/PostMedia", () => ({ default: () => null }));
vi.mock("@/components/feed/CommentThread", () => ({ default: () => null }));

const props = (over: Partial<FeedPostCardProps> = {}): FeedPostCardProps => ({
  post: { id: "p1", user_id: "someone", content: "proof", reported: true, created_at: new Date().toISOString(), author: { username: "someone" } },
  index: 0, currentUserId: "me", isAdmin: true, canPost: true, liked: false, hasGivenKudos: false, verified: false,
  kudosRemaining: 3, kudosPerMonth: 3, isCommentsOpen: false, commentTree: [], editingCommentId: null,
  setEditingCommentId: vi.fn(), replyTo: null, setReplyTo: vi.fn(), commentText: "", setCommentText: vi.fn(),
  commentInputRef: { current: null }, composerInitial: "", onReply: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(),
  onSubmitComment: vi.fn(), addCommentPending: false, onNavigateUser: vi.fn(), onToggleReaction: vi.fn(),
  onToggleComments: vi.fn(), onGiveKudos: vi.fn(), onDeletePost: vi.fn(), onReportPost: vi.fn(),
  onAdminDelete: vi.fn(), onUnreport: vi.fn(), onOpenLightbox: vi.fn(), giveKudosPending: false,
  ...over,
});

describe("FeedPostCard delete", () => {
  it("asks before removing, and cancel removes nothing", () => {
    const p = props();
    render(<MemoryRouter><FeedPostCard {...p} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(p.onAdminDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Remove this post?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.onAdminDelete).not.toHaveBeenCalled();
  });

  it("removes once confirmed", () => {
    const p = props();
    render(<MemoryRouter><FeedPostCard {...p} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(p.onAdminDelete).toHaveBeenCalledWith("p1");
    expect(p.onDeletePost).not.toHaveBeenCalled();
  });
});
