import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FREEFORM_COPY, promptById } from "@/lib/pilot/prompts";

/**
 * The host, and the one thing it must not do to the sheet.
 *
 * It used to clear its own prompt state inside the same `onSubmit` the sheet
 * awaits. That made `open` false, which returned null from the host, which
 * unmounted the sheet mid-await — so `setSent(true)` landed on a dead
 * component, "Kiitos — luemme tämän." never painted, the 1 200 ms it was
 * meant to sit there never elapsed, and the sheet cut out without its exit
 * animation. Every tester who sent feedback got nothing back.
 *
 * FeedbackSheet's own tests could not catch it: their `onSubmit` was a bare
 * mock that never unmounted anything, which is the one arrangement production
 * never has. The bug lived in the seam, so the test has to own both sides.
 */

const submit = vi.fn<(...a: unknown[]) => Promise<boolean>>();
const mark = vi.fn<(...a: unknown[]) => Promise<void>>();

vi.mock("@/hooks/use-pilot", () => ({
  usePilotContext: () => ({
    context: { is_pilot: true, in_window: true, day: 1, observe_days: 14, cohort: "test" },
    loading: false,
  }),
  usePromptLog: () => ({ log: {}, loading: false }),
  usePilotSignals: () => ({ checkedIn: true, trained: true, askedCoach: false, recovered: false }),
  useSubmitFeedback: () => submit,
  useMarkPrompt: () => mark,
}));

vi.mock("@/components/onboarding/onboarding-context", () => ({
  useOnboarding: () => ({ activeEventId: null }),
}));

const day1 = promptById("DAY1")!;

const mount = async () => {
  const { default: PilotHost } = await import("../PilotHost");
  render(
    <MemoryRouter>
      <PilotHost />
    </MemoryRouter>,
  );
  // The host asks once per launch, from an effect.
  await waitFor(() => expect(screen.getByText(day1.title)).toBeInTheDocument());
};

const answerAndSend = () => {
  fireEvent.click(screen.getByRole("button", { name: day1.choice!.options[0].label }));
  fireEvent.click(screen.getByRole("button", { name: FREEFORM_COPY.submit }));
};

describe("the host, after a tester sends feedback", () => {
  beforeEach(() => {
    vi.resetModules(); // the launch cap is module-level and must not leak between tests
    submit.mockReset().mockResolvedValue(true);
    mark.mockReset().mockResolvedValue(undefined);
  });

  it("leaves the sheet mounted long enough to thank them", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await mount();
    answerAndSend();
    await waitFor(() =>
      expect(
        screen.getByText(FREEFORM_COPY.sent),
        "the host closed the sheet before it could say thank you",
      ).toBeInTheDocument(),
    );
    vi.useRealTimers();
  });

  it("then takes it away on the sheet's own timing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await mount();
    answerAndSend();
    await waitFor(() => expect(screen.getByText(FREEFORM_COPY.sent)).toBeInTheDocument());
    await act(async () => { vi.advanceTimersByTime(1300); });
    await waitFor(() => expect(screen.queryByText(FREEFORM_COPY.sent)).not.toBeInTheDocument());
    vi.useRealTimers();
  });

  it("never records an answered question as dismissed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await mount();
    answerAndSend();
    // Wait for the send to land, then let the thank-you time out. The
    // claim is about what reached the log, not about the DOM.
    await waitFor(() => expect(submit).toHaveBeenCalled());
    await act(async () => { vi.advanceTimersByTime(1300); });
    const dismissals = mark.mock.calls.filter((c) => c[1] === "dismissed");
    expect(dismissals, `answered-then-dismissed is not a state the log should hold`).toEqual([]);
    vi.useRealTimers();
  });

  it("does record a dismissal when they choose not to answer", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Ei nyt" }));
    await waitFor(() =>
      expect(mark.mock.calls.some((c) => c[0] === day1.id && c[1] === "dismissed")).toBe(true),
    );
  });

  it("keeps the sheet and the draft when the write failed", async () => {
    submit.mockResolvedValue(false);
    await mount();
    answerAndSend();
    await waitFor(() => expect(screen.queryByText(FREEFORM_COPY.sent)).not.toBeInTheDocument());
    expect(screen.getByText(day1.title), "a failed send must not take the sheet away").toBeInTheDocument();
  });
});
