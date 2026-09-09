import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorState } from "../error-state";

vi.mock("@/lib/haptics", () => ({ hapticImpact: vi.fn(), hapticSelection: vi.fn(), hapticNotification: vi.fn() }));

describe("ErrorState", () => {
  it("names the failure and retries once per tap", () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Couldn't load the feed" onRetry={onRetry} />);
    expect(screen.getByText("Couldn't load the feed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
