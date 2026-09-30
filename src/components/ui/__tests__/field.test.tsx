import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input, FIELD } from "../input";
import { Textarea } from "../textarea";
import { Label, FIELD_LABEL } from "../label";

// One field: the 44 pt floor, the button scale's radius, 16 px (iOS does not
// zoom), one focus answer through the border and a bloom — no control ring.
describe("the text field", () => {
  it("Input and Textarea share the field and its focus", () => {
    render(
      <>
        <Input aria-label="a" />
        <Textarea aria-label="b" />
      </>,
    );
    for (const name of ["a", "b"]) {
      const cls = screen.getByLabelText(name).className;
      expect(cls, name).toContain("surface-inset");
      expect(cls, name).toContain(name === "a" ? "min-h-11" : "min-h-24");
      expect(cls, name).toContain("rounded-xl");
      expect(cls, name).toContain("text-copy");
      expect(cls, name).toContain("transition-[border-color,box-shadow,background-color,opacity]");
      expect(cls, name).not.toMatch(/duration-|ease-|timing-function/); // the default clock
      expect(cls, name).toContain("focus-visible:border-[hsl(var(--gold)/0.55)]");
      expect(cls, name).toContain("aria-[invalid=true]:border-");
      expect(cls, name).not.toMatch(/ring-2|focus-visible:ring/);
    }
    expect(FIELD.split(" ")).not.toContain("h-11"); // the Input adds the height; a Textarea grows
  });

  it("a site override wins over the default (cn is twMerge)", () => {
    render(<Input aria-label="tall" className="h-12 rounded-full" />);
    const cls = screen.getByLabelText("tall").className.split(" ");
    expect(cls).toContain("h-12");
    expect(cls).not.toContain("h-11");
    expect(cls).toContain("rounded-full");
    expect(cls).not.toContain("rounded-xl");
  });

  it("the label speaks in the field-label voice", () => {
    render(<Label htmlFor="x">Name</Label>);
    expect(screen.getByText("Name").className).toContain(FIELD_LABEL);
  });
});
