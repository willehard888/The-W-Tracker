import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useState } from "react";
import FeedbackSheet from "../FeedbackSheet";
import { promptById, FREEFORM_COPY } from "@/lib/pilot/prompts";

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

/**
 * The thank-you, and the parent that used to destroy it.
 *
 * PilotHost cleared its prompt state inside the same `onSubmit` this sheet
 * awaits, which made the host render null and unmounted this component before
 * it could set `sent`. "Kiitos — luemme tämän." never painted, the 1 200 ms it
 * was meant to sit there never elapsed, and the sheet vanished without its
 * exit animation. Every tester who did the one thing we asked for got nothing
 * back.
 *
 * The old tests passed because their `onSubmit` was a bare mock that never
 * unmounted anything — they asserted the one arrangement production never has.
 * These re-create the parent, closing over the same state it owns.
 */
describe("what the sheet does after a send", () => {
  /** A stand-in for PilotHost: owns `open`, and only closes when told to. */
  const Host = ({ onSubmit }: { onSubmit: () => Promise<boolean> }) => {
    const [open, setOpen] = useState(true);
    const [dismissedWith, setDismissedWith] = useState<boolean | undefined>(undefined);
    return (
      <>
        <span data-testid="dismissed">{String(dismissedWith)}</span>
        {open ? (
          <FeedbackSheet
            open
            prompt={day1}
            onDismiss={(sent) => { setDismissedWith(sent); setOpen(false); }}
            onSubmit={onSubmit}
          />
        ) : null}
      </>
    );
  };

  const send = async () => {
    fireEvent.click(screen.getByRole("button", { name: day1.choice!.options[0].label }));
    fireEvent.click(screen.getByRole("button", { name: FREEFORM_COPY.submit }));
  };

  it("thanks the athlete, and is still on screen to do it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Host onSubmit={() => Promise.resolve(true)} />);
    await send();
    await waitFor(() => expect(screen.getByText(FREEFORM_COPY.sent)).toBeInTheDocument());
    vi.useRealTimers();
  });

  it("takes itself away once the thank-you has been read", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Host onSubmit={() => Promise.resolve(true)} />);
    await send();
    await waitFor(() => expect(screen.getByText(FREEFORM_COPY.sent)).toBeInTheDocument());
    await act(async () => { vi.advanceTimersByTime(1300); });
    await waitFor(() => expect(screen.queryByText(FREEFORM_COPY.sent)).not.toBeInTheDocument());
    vi.useRealTimers();
  });

  it("tells the parent this was a send, not a dismissal", async () => {
    // Recording an answered question as dismissed would stop it returning for
    // the wrong reason, and answered-then-dismissed is not a state the log
    // should ever hold.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Host onSubmit={() => Promise.resolve(true)} />);
    await send();
    await act(async () => { vi.advanceTimersByTime(1300); });
    await waitFor(() => expect(screen.getByTestId("dismissed").textContent).toBe("true"));
    vi.useRealTimers();
  });

  it("keeps the draft and says nothing when the write failed", async () => {
    render(<Host onSubmit={() => Promise.resolve(false)} />);
    await send();
    await waitFor(() =>
      expect(screen.queryByText(FREEFORM_COPY.sent), "a failed send must not thank anybody").not.toBeInTheDocument(),
    );
    expect(screen.getByText(day1.title), "and the sheet stays put").toBeInTheDocument();
  });
});
