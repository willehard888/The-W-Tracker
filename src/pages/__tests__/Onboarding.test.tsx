import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Onboarding from "@/pages/Onboarding";

/**
 * The four answers used to live in plain useState: a force-quit at question
 * three restarted the whole flow from the welcome slide with nothing kept.
 * These cover the resume — where it lands, what it still knows, and that the
 * draft does not outlive the run.
 */

const mocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@/lib/analytics", () => ({
  track: mocks.track,
  FUNNEL: {
    onboardingViewed: "onboarding_viewed",
    onboardingStep: "onboarding_step",
    onboardingDone: "onboarding_done",
    onboardingSkipped: "onboarding_skipped",
  },
}));
vi.mock("@/lib/haptics", () => ({
  hapticImpact: vi.fn(), hapticSelection: vi.fn(), hapticNotification: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: () => Promise.resolve({ error: null }) },
}));
// The slide transition is a 200 ms exit-then-enter; the step the flow lands on
// is what is under test, not the animation.
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
}));

const renderOnboarding = () =>
  render(<MemoryRouter initialEntries={["/onboarding"]}><Onboarding /></MemoryRouter>);

describe("Onboarding resume", () => {
  beforeEach(() => { localStorage.clear(); mocks.track.mockClear(); });

  it("resumes on the question the run stopped at, still holding the earlier answers", () => {
    localStorage.setItem("w_onboarding_draft_v1", JSON.stringify({ primary_goal: "strength", sports: ["running"] }));
    localStorage.setItem("w_onboarding_step_v1", "3");

    renderOnboarding();

    expect(screen.getByRole("heading", { name: "How often do you train right now?" })).toBeInTheDocument();
    expect(screen.getByText("3/4")).toBeInTheDocument();

    // Skip ends the run: it reports what the flow knew, and the draft goes.
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(mocks.track).toHaveBeenCalledWith(
      "onboarding_skipped",
      expect.objectContaining({ answers: { primary_goal: "strength", sports: ["running"] } }),
    );
    expect(localStorage.getItem("w_onboarding_draft_v1")).toBeNull();
    expect(localStorage.getItem("w_onboarding_step_v1")).toBeNull();
  });

  it("writes each answer down as it is given, so a force-quit has something to come back to", async () => {
    localStorage.setItem("w_onboarding_step_v1", "1");

    renderOnboarding();
    // Single-select commits 250 ms after the tap, so the gold state lands first.
    fireEvent.click(screen.getByText("Get stronger"));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("w_onboarding_draft_v1") ?? "{}")).toEqual({ primary_goal: "strength" });
    });
    expect(localStorage.getItem("w_onboarding_step_v1")).toBe("2");
  });

  it("starts a first run at the welcome slide, and junk in either key does not break it", () => {
    localStorage.setItem("w_onboarding_draft_v1", "{not json");
    localStorage.setItem("w_onboarding_step_v1", "-4");

    renderOnboarding();

    // Welcome: no Skip, and no blank slide from an out-of-bounds step index.
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /build my setup/i })).toBeInTheDocument();
  });
});
