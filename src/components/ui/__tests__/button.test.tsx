import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../button";

describe("Button hit areas", () => {
  it("ghost sm gets the 44 pt halo, ember sm does not (its ::before is the sheen)", () => {
    render(
      <>
        <Button variant="ghost" size="sm">a</Button>
        <Button variant="ember" size="sm">b</Button>
        <Button variant="outline" size="pill">c</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "a" }).className).toContain("before:-inset-1");
    expect(screen.getByRole("button", { name: "b" }).className).not.toContain("before:-inset-1");
    expect(screen.getByRole("button", { name: "c" }).className).toContain("before:-inset-1");
  });
});
