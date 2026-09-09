import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { navigateSafely, setNavigator } from "../router-bridge";
import { backOr } from "../nav";

const Probe = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => { setNavigator(navigate); }, [navigate]);
  return <span data-testid="path">{pathname}</span>;
};
const App = () => (
  <BrowserRouter>
    <Routes><Route path="*" element={<Probe />} /></Routes>
  </BrowserRouter>
);
const idx = () => (window.history.state as { idx?: number } | null)?.idx;

describe("navigateSafely", () => {
  beforeEach(() => { window.history.replaceState(null, "", "/"); });

  it("queues a route until the router mounts", () => {
    navigateSafely("/coach");
    const { getByTestId } = render(<App />);
    expect(getByTestId("path").textContent).toBe("/coach");
    expect(idx()).toBe(1);
  });

  it("pushes through the router so backOr can pop afterwards", () => {
    const { getByTestId } = render(<App />);
    expect(idx()).toBe(0);
    act(() => navigateSafely("/notifications"));
    expect(getByTestId("path").textContent).toBe("/notifications");
    expect(idx()).toBe(1);
    const navigate = vi.fn();
    backOr(navigate, "/");
    expect(navigate).toHaveBeenCalledWith(-1);
  });
});
