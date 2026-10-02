import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { DoorRow, QuestionRow } from "../rows";
import { SettingsRow } from "@/components/settings/SettingsList";

// THE list row: one silhouette for a door, a settings row, a library row.
describe("DoorRow", () => {
  it("is a 44 pt press-row with the list rhythm and a chevron", () => {
    render(<DoorRow icon={Settings} label="Athlete profile" sub="Goals, schedule" onClick={() => {}} />);
    const row = screen.getByRole("button", { name: /Athlete profile/ });
    const cls = row.className.split(" ");
    for (const c of ["press-row", "w-full", "min-h-11", "py-3", "gap-3", "text-left"]) expect(cls).toContain(c);
    expect(row.querySelector("svg.lucide-chevron-right")).not.toBeNull();
    expect(screen.getByText("Goals, schedule")).toBeInTheDocument();
  });

  it("takes a leading visual and a trailing value, and stays quiet when disabled", () => {
    const onClick = vi.fn();
    render(
      <DoorRow leading={<span data-testid="thumb" />} label="Hip hinge" trailing={<span>8 min</span>} onClick={onClick} disabled />,
    );
    expect(screen.getByTestId("thumb")).toBeInTheDocument();
    expect(screen.getByText("8 min")).toBeInTheDocument();
    const row = screen.getByRole("button");
    expect(row).toBeDisabled();
    row.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("SettingsRow is the DoorRow with a card's side padding and a badge", () => {
    render(<SettingsRow icon={Settings} label="Notifications" sub="Reminders" badge={3} onClick={() => {}} />);
    const row = screen.getByRole("button", { name: /Notifications/ });
    expect(row.className.split(" ")).toContain("px-4");
    expect(row.className.split(" ")).toContain("press-row");
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(row.querySelector("svg.lucide-chevron-right")).not.toBeNull();
  });
});

// The ready question: wraps, gold chevron, the same press-row rhythm.
describe("QuestionRow", () => {
  it("is a press-row whose text wraps and whose chevron is gold", () => {
    const onClick = vi.fn();
    render(<QuestionRow question="Should I add 2.5 kg to the squat on Thursday?" onClick={onClick} />);
    const row = screen.getByRole("button", { name: "Should I add 2.5 kg to the squat on Thursday?" });
    const cls = row.className.split(" ");
    for (const c of ["press-row", "w-full", "min-h-11", "text-left"]) expect(cls).toContain(c);
    expect(row.querySelector("span")?.className).not.toMatch(/truncate/);
    expect(row.querySelector("svg.lucide-chevron-right")?.getAttribute("class")).toMatch(/text-gold/);
    row.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
