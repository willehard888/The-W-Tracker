import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../button";

const VARIANTS = [
  "default", "ember", "ember-outline", "gold-soft", "ember-glass", "gold-icon",
  "destructive", "outline", "secondary", "ghost", "link", "gold-outline", "tier", "danger-outline",
] as const;

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

describe("Button — one press, one focus, one depth", () => {
  it("every variant rides the shared 140 ms transition and none carries its own focus ring", () => {
    render(<>{VARIANTS.map((v) => <Button key={v} variant={v}>{v}</Button>)}</>);
    for (const v of VARIANTS) {
      const cls = screen.getByRole("button", { name: v }).className;
      expect(cls, v).toContain("transition-[transform,background-color,border-color,color,box-shadow,filter,opacity]");
      // The default clock (140 ms, iOS curve): no duration of its own. The
      // ember sheen's after:duration-700 is the glint, not the press.
      expect(cls, v).not.toMatch(/(?<!after:)duration-|timing-function/);
      expect(cls, v).not.toMatch(/ring-2|focus-visible:ring/);
    }
  });

  it("every flat variant answers a press (an active: state), not only a hover", () => {
    const flat = ["destructive", "outline", "secondary", "ghost", "link", "gold-outline", "tier", "danger-outline"] as const;
    render(<>{flat.map((v) => <Button key={v} variant={v}>{v}</Button>)}</>);
    for (const v of flat) expect(screen.getByRole("button", { name: v }).className, v).toMatch(/\bactive:/);
  });

  it("sizes follow one radius scale", () => {
    render(
      <>
        <Button size="xs">xs</Button><Button size="sm">sm</Button><Button size="icon-sm" aria-label="icon-sm" />
        <Button size="default">default</Button><Button size="lg">lg</Button><Button size="icon" aria-label="icon" />
        <Button size="xl">xl</Button><Button size="pill">pill</Button>
      </>,
    );
    const radius = (name: string) => screen.getByRole("button", { name }).className.match(/\brounded-(?:\w+|full)\b/g);
    for (const n of ["xs", "sm", "icon-sm"]) expect(radius(n), n).toEqual(["rounded-lg"]);
    for (const n of ["default", "lg", "icon"]) expect(radius(n), n).toEqual(["rounded-xl"]);
    expect(radius("xl")).toEqual(["rounded-2xl"]);
    expect(radius("pill")).toEqual(["rounded-full"]);
  });

  it("asChild keeps loading and disabled: busy, aria-disabled, and the click does not fire", () => {
    const onClick = vi.fn();
    render(
      <Button asChild loading onClick={onClick}>
        <a href="/x">go</a>
      </Button>,
    );
    const a = screen.getByRole("link", { name: "go" });
    expect(a).toHaveAttribute("aria-busy", "true");
    expect(a).toHaveAttribute("aria-disabled", "true");
    expect(a).toHaveAttribute("data-loading", "true");
    a.addEventListener("click", (e) => e.preventDefault());
    a.click();
    expect(onClick).not.toHaveBeenCalled();
  });
});
