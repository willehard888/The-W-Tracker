import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AnswerRating from "../AnswerRating";

describe("rating an AI answer", () => {
  it("offers both verdicts, named for a screen reader", () => {
    render(<AnswerRating onRate={() => {}} />);
    expect(screen.getByRole("button", { name: "This answer helped" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This answer did not help" })).toBeInTheDocument();
  });

  it("reports which way the verdict went", () => {
    const onRate = vi.fn();
    const { rerender } = render(<AnswerRating onRate={onRate} />);
    fireEvent.click(screen.getByRole("button", { name: "This answer helped" }));
    expect(onRate).toHaveBeenCalledWith(true);

    rerender(<AnswerRating onRate={onRate} />);
    fireEvent.click(screen.getByRole("button", { name: "This answer did not help" }));
    expect(onRate).toHaveBeenLastCalledWith(false);
    expect(onRate).toHaveBeenCalledTimes(2);
  });

  // The verdict rides on the message and saves with the thread, so a rated
  // answer must not offer the question again on the next open.
  it("is over once answered — the buttons go, they are not just disabled", () => {
    render(<AnswerRating rated="up" onRate={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Noted — thanks.")).toBeInTheDocument();
  });

  it("says the same thing for a thumbs down — no scolding, no follow-up", () => {
    render(<AnswerRating rated="down" onRate={() => {}} />);
    expect(screen.getByText("Noted — thanks.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  // 44 pt is the house floor (style-guard rules 18-19) and these are the
  // smallest targets on the screen.
  it("keeps a thumb-sized target under a 13px icon", () => {
    render(<AnswerRating onRate={() => {}} />);
    for (const b of screen.getAllByRole("button")) {
      expect(b.className).toContain("min-h-11");
      expect(b.className).toContain("min-w-11");
    }
  });
});
