import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Persist scroll position per route within the session.
 *
 * - On `POP` (back/forward): restore previous Y for that path.
 * - On `PUSH` / `REPLACE`: scroll to top instantly.
 *
 * Saves throttled to rAF so listening to scroll has no perf cost.
 */
export const useRouteScrollMemory = (
  ref: React.RefObject<HTMLDivElement>,
) => {
  const location = useLocation();
  const navType = useNavigationType();
  const memory = useRef<Map<string, number>>(new Map());
  const currentPath = useRef(location.pathname);

  // Save scrollY of the path we're leaving.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const path = currentPath.current;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        memory.current.set(path, el.scrollTop);
        frame = 0;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      // Final save on unmount
      memory.current.set(path, el.scrollTop);
    };
  }, [ref, location.pathname]);

  // On path change, restore or reset.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    currentPath.current = location.pathname;
    if (navType === "POP") {
      const y = memory.current.get(location.pathname) ?? 0;
      // Two rAF: wait for new content to mount before restoring.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollTo({ top: y, left: 0, behavior: "auto" });
        });
      });
    } else {
      el.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [ref, location.pathname, navType]);
};
