import { useEffect } from "react";
import { startWind, stopWind } from "@/lib/wind";

/**
 * Mounts the shared wind rAF loop on app start. Pure side-effect — no
 * React state, no context value (flames read CSS vars directly).
 */
const WindProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Respect reduced motion: skip the loop entirely.
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) {
      document.documentElement.style.setProperty("--wind-x", "0");
      document.documentElement.style.setProperty("--wind-gust", "0");
      return;
    }
    startWind();
    return () => stopWind();
  }, []);

  return <>{children}</>;
};

export default WindProvider;
