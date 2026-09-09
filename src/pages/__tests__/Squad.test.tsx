import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Squad from "@/pages/Squad";

/**
 * /messages was an orphan route: BottomNav mapped it to the Squad tab and
 * Messages' Back returned here, but nothing on screen ever went there. These
 * cover the door itself — that it exists, that it names its unread count, and
 * that it actually navigates.
 */

const state = vi.hoisted(() => ({ unread: 0 }));

vi.mock("@/lib/haptics", () => ({
  hapticImpact: vi.fn(),
  hapticSelection: vi.fn(),
  hapticNotification: vi.fn(),
}));
vi.mock("@/pages/EliteFeed", () => ({ default: () => <div /> }));
vi.mock("@/pages/Tribes", () => ({ default: () => <div /> }));
vi.mock("@/hooks/use-messages", () => ({
  useUnreadMessageCount: () => ({ data: state.unread }),
}));

const renderSquad = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/squad"]}>
        <Routes>
          <Route path="/squad" element={<Squad />} />
          <Route path="/messages" element={<div>messages screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("Squad's Messages door", () => {
  beforeEach(() => { state.unread = 0; });

  it("offers a Messages button with no count when nothing is unread", () => {
    renderSquad();
    expect(screen.getByRole("button", { name: "Messages" })).toBeInTheDocument();
  });

  it("names the unread count and shows it on the badge", () => {
    state.unread = 3;
    renderSquad();
    const button = screen.getByRole("button", { name: "Messages — 3 unread" });
    expect(button).toHaveTextContent("3");
  });

  it("navigates to /messages when tapped", () => {
    renderSquad();
    fireEvent.click(screen.getByRole("button", { name: "Messages" }));
    expect(screen.getByText("messages screen")).toBeInTheDocument();
  });
});
