import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FeedbackSheet from "../FeedbackSheet";
import { promptById } from "@/lib/pilot/prompts";

const day1 = promptById("DAY1")!;
const workout = promptById("AFTER_FIRST_WORKOUT")!;

const setup = (over: Partial<Parameters<typeof FeedbackSheet>[0]> = {}) => {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const onDismiss = vi.fn();
  render(<FeedbackSheet open prompt={day1} onDismiss={onDismiss} onSubmit={onSubmit} {...over} />);
  return { onSubmit, onDismiss };
};

describe("asking one question", () => {
  it("shows the question, the scale and the options", () => {
    setup();
    expect(screen.getByText(day1.title)).toBeInTheDocument();
    expect(screen.getByText(day1.scale!.question)).toBeInTheDocument();
    expect(screen.getByText(day1.scale!.low)).toBeInTheDocument();
    expect(screen.getByText(day1.choice!.question)).toBeInTheDocument();
    for (const o of day1.choice!.options) expect(screen.getByText(o.label)).toBeInTheDocument();
  });

  // The brief's rule: feedback must not get in the way of the behaviour we are
  // trying to observe. Nothing is required, and there is always a way out.
  it("requires nothing, and offers a way out that is not the send button", () => {
    const { onDismiss } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Ei nyt" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("will not send an empty answer", () => {
    setup();
    expect(screen.getByRole("button", { name: "Lähetä" })).toBeDisabled();
  });

  it("sends as soon as any one thing is answered", async () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    const send = screen.getByRole("button", { name: "Lähetä" });
    expect(send).toBeEnabled();
    fireEvent.click(send);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ rating: 4, choice: null, comment: null }),
    );
  });

  it("carries all three answers when all three are given", async () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByText("Liikaa asiaa kerralla"));
    fireEvent.change(screen.getByLabelText(day1.comment!.label), { target: { value: "  liikaa nappeja  " } });
    fireEvent.click(screen.getByRole("button", { name: "Lähetä" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ rating: 2, choice: "too_much", comment: "liikaa nappeja" }),
    );
  });

  // Every answer is optional, including one already given.
  it("lets a chosen option be un-chosen", async () => {
    const { onSubmit } = setup();
    const option = screen.getByText("Mistä aloittaa");
    fireEvent.click(option);
    expect(option.closest("button")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(option);
    expect(option.closest("button")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Lähetä" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("thanks them once it lands", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: "Lähetä" }));
    await waitFor(() => expect(screen.getByText("Kiitos — luemme tämän.")).toBeInTheDocument());
  });

  // A failed send must not throw the draft away — that is somebody's typed
  // sentence, and a lost sentence is not given twice.
  it("keeps the draft when the send fails", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(<FeedbackSheet open prompt={day1} onDismiss={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(day1.comment!.label), { target: { value: "tärkeä havainto" } });
    fireEvent.click(screen.getByRole("button", { name: "Lähetä" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.getByLabelText(day1.comment!.label)).toHaveValue("tärkeä havainto");
    expect(screen.queryByText("Kiitos — luemme tämän.")).toBeNull();
  });

  it("renders a question that has no scale without inventing one", () => {
    render(<FeedbackSheet open prompt={workout} onDismiss={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByText(workout.choice!.question)).toBeInTheDocument();
    // The 1-5 buttons belong to the scale; this prompt has none.
    expect(screen.queryByRole("button", { name: "3" })).toBeNull();
  });
});

describe("the always-open door", () => {
  it("asks what kind of thing it is, in the tester's language", () => {
    render(<FeedbackSheet open prompt={null} onDismiss={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByText("Kerro meille")).toBeInTheDocument();
    expect(screen.getByText("Jokin on rikki")).toBeInTheDocument();
    expect(screen.getByText("Idea tai toive")).toBeInTheDocument();
  });

  // We cannot stop somebody typing a health detail into a free-text box, so we
  // say so where they are about to type.
  it("says not to put health data in the box", () => {
    render(<FeedbackSheet open prompt={null} onDismiss={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(/terveystietoja/)).toBeInTheDocument();
  });
});
