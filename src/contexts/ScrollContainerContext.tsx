import { createContext, useContext, useEffect, type RefObject } from "react";

/**
 * The app shell owns the ONE vertical scroller (App.tsx). Sheets and
 * overlays lock it through useScrollLock — `document.body.style.overflow`
 * was a no-op here because the body never scrolls, so every sheet bled
 * touch-scroll through to the page behind it.
 */
const ScrollContainerContext = createContext<RefObject<HTMLDivElement> | null>(null);

export const ScrollContainerProvider = ScrollContainerContext.Provider;

export const useScrollContainer = () => useContext(ScrollContainerContext);

const locks = new Set<symbol>();

/**
 * Locks the shell scroller (and body, for web) while `active`; the last lock
 * to release restores. Restore means clearing the inline style — the class
 * owns the real value. Capturing the "previous" value per lock left the app
 * unscrollable for good whenever two locks overlapped (a lightbox over a
 * sheet): the second lock captured "hidden" and faithfully restored it.
 */
export function useScrollLock(active: boolean) {
  const ref = useContext(ScrollContainerContext);
  useEffect(() => {
    if (!active) return;
    const el = ref?.current ?? null;
    const token = Symbol("scroll-lock");
    locks.add(token);
    if (el) el.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      locks.delete(token);
      if (locks.size === 0) {
        if (el) el.style.overflow = "";
        document.body.style.overflow = "";
      }
    };
  }, [active, ref]);
}
