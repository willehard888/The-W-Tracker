import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

const brief = vi.fn();
vi.mock("@/hooks/use-coach-brief", () => ({ useCoachBrief: () => ({ brief: brief(), isLoading: false, error: null }) }));
vi.mock("react-markdown", () => ({ default: ({ children }: { children: string }) => <p>{children}</p> }));

import CoachBriefHero from "@/components/coach/v2/CoachBriefHero";

/**
 * Feedback first, questions second, typing last: the brief's three questions
 * are the primary rows and the chat is a quiet link under them — the ember
 * "Ask your coach" button used to be the loudest thing on the page.
 */
describe("CoachBriefHero", () => {
  it("renders the brief's questions as the primary rows and the chat as a link", () => {
    brief.mockReturnValue({
      ribbon: "Day 12 · on track", brief_md: "Sleep 7.6 h. Squat day.", prescriptions: [{ label: "protein", value: "160 g" }],
      suggested_questions: ["Should I add 2.5 kg to the squat today?", "Why was my HRV down on Tuesday?", "Is 9 000 steps enough on a rest day?", "a fourth"],
    });
    const onAsk = vi.fn();
    const onOpenChat = vi.fn();
    render(<CoachBriefHero readiness={72} onOpenChat={onOpenChat} onAsk={onAsk} />);
    const rows = within(screen.getByLabelText("Ask about today's brief")).getAllByRole("button");
    expect(rows).toHaveLength(3);
    rows[1].click();
    expect(onAsk).toHaveBeenCalledWith("Why was my HRV down on Tuesday?", 1);
    const ask = screen.getByRole("button", { name: "Something else? Ask" });
    expect(ask.className).not.toMatch(/ember/);
    ask.click();
    expect(onOpenChat).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Ask your coach/ })).toBeNull();
  });

  it("without a brief still offers the quiet way in", () => {
    brief.mockReturnValue(null);
    render(<CoachBriefHero readiness={null} onOpenChat={vi.fn()} onAsk={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Something else? Ask" })).toBeInTheDocument();
  });
});
