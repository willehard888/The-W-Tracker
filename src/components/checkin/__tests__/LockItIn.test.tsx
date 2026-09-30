import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LockItIn from "../LockItIn";

// The check-in's lock: a gold bar that only answers when armed, says it is
// busy while locking, and engraves "Locked · Day N" with a drawn check.
describe("LockItIn", () => {
  it("armed: the label carries the XP and a tap fires", () => {
    const onClick = vi.fn();
    render(<LockItIn xp={23} day={3} state="armed" onClick={onClick} />);
    const bar = screen.getByRole("button");
    expect(bar).toHaveTextContent("Lock it in · +23 XP");
    expect(bar).not.toHaveAttribute("aria-busy");
    bar.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("waiting: disabled propagates and a tap does nothing", () => {
    const onClick = vi.fn();
    render(<LockItIn xp={23} day={3} state="armed" disabled onClick={onClick} />);
    const bar = screen.getByRole("button");
    expect(bar).toBeDisabled();
    bar.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("locking: busy, the state class, and no second tap", () => {
    const onClick = vi.fn();
    render(<LockItIn xp={23} day={3} state="locking" onClick={onClick} />);
    const bar = screen.getByRole("button");
    expect(bar).toHaveAttribute("aria-busy", "true");
    expect(bar.className.split(" ")).toContain("is-locking");
    bar.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("locked: the engraving, the check path and the rising XP", () => {
    const { container } = render(<LockItIn xp={23} day={3} state="locked" onClick={() => {}} />);
    const bar = screen.getByRole("button");
    expect(bar.className.split(" ")).toContain("is-locked");
    expect(bar).toHaveTextContent("Locked · Day 3");
    expect(container.querySelector("svg.lock-chk path")).not.toBeNull();
    expect(container.querySelector(".lock-xp")).toHaveTextContent("+23 XP");
    for (const c of ["lock-bloom", "lock-ring", "lock-house", "lock-face", "lock-spec", "lock-catch"]) {
      expect(container.querySelector("." + c), c).not.toBeNull();
    }
  });
});
