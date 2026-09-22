import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TodaysPlanCard from "@/components/coach/TodaysPlanCard";
import type { useDailyPlan } from "@/hooks/use-daily-plan";

/**
 * The card's rows are reminders the day's data settles, never buttons: the
 * footer has to say which of the three days it is — nothing recorded yet,
 * checked in with some covered, everything covered.
 */

vi.mock("@/lib/haptics", () => ({ hapticImpact: vi.fn(), hapticNotification: vi.fn() }));

const plan = {
  id: "p1",
  user_id: "u1",
  plan_date: "2026-09-22",
  readiness_score: 73,
  readiness_breakdown: { avg_sleep_h: 8, missed_7d: 1 },
  adjustment: "hold" as const,
  headline: "Steady day, protect the evening.",
  missions: [
    { id: "light", kind: "habit" as const, title: "Morning light", why: "Your sleep window drifted late twice this week.", xp: 0, priority: "high" as const, protocol_id: "morning-light-10min" },
    { id: "wind", kind: "focus" as const, title: "Evening wind-down", detail: "Ten minutes, no screens.", xp: 0, priority: "medium" as const, protocol_id: "journaling-5min" },
  ],
  generated_at: "2026-09-22T06:00:00Z",
};

const daily = (over: Partial<ReturnType<typeof useDailyPlan>>): ReturnType<typeof useDailyPlan> => ({
  isLoading: false,
  plan,
  checkedIn: false,
  completedIds: new Set<string>(),
  done: 0,
  total: 2,
  refetch: vi.fn(),
  generate: vi.fn(async () => ({})),
  ...over,
});

const mount = (d: ReturnType<typeof useDailyPlan>) =>
  render(
    <MemoryRouter>
      <TodaysPlanCard daily={d} />
    </MemoryRouter>,
  );

describe("TodaysPlanCard", () => {
  it("shows the coach's why and no tick buttons", () => {
    mount(daily({}));
    expect(screen.getByText("Your sleep window drifted late twice this week.")).toBeInTheDocument();
    expect(screen.getByText("Ten minutes, no screens.")).toBeInTheDocument(); // detail when there is no why
    expect(screen.queryByRole("button", { name: /morning light/i })).toBeNull();
    expect(screen.getByText("Your check-in tonight settles these.")).toBeInTheDocument();
  });

  it("counts what the check-in covered", () => {
    mount(daily({ checkedIn: true, completedIds: new Set(["light"]), done: 1 }));
    expect(screen.getByText("1 of 2 covered · from today's check-in")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Covered by today's check-in" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Not yet recorded" })).toBeInTheDocument();
  });

  it("credits what the app saw itself before the check-in", () => {
    mount(daily({ completedIds: new Set(["wind"]), done: 1 }));
    expect(screen.getByText("1 of 2 covered · your check-in tonight settles the rest.")).toBeInTheDocument();
  });

  it("says so when everything is covered", () => {
    mount(daily({ checkedIn: true, completedIds: new Set(["light", "wind"]), done: 2 }));
    expect(screen.getByText("All covered. You showed up.")).toBeInTheDocument();
  });
});
