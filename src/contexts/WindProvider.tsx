import { useEffect } from "react";
import { startWind, stopWind, attachPointerWind, detachPointerWind } from "@/lib/wind";

/**
 * Mounts the shared wind rAF loop on app start. Pure side-effect — no
 * React state, no context value (flames read CSS vars directly).
 *
 * Also wires up the pointer-wind tracker so flames can lean toward the
 * user's cursor / touch (pure CSS-var side effect, no React rerenders).
 */
const WindProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Respect reduced motion: skip the loop entirely.
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) {
      document.documentElement.style.setProperty("--wind-x", "0");
      document.documentElement.style.setProperty("--wind-gust", "0");
      document.documentElement.style.setProperty("--pointer-wind-x", "0");
      return;
    }
    startWind();
    attachPointerWind();
    return () => {
      stopWind();
      detachPointerWind();
    };
  }, []);

  return <>{children}</>;
};

export default WindProvider;
