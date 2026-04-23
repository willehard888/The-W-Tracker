import { useCallback, useRef } from "react";
import { hapticImpact } from "@/lib/haptics";

interface Options {
  /** Min horizontal distance (px) to register a swipe. */
  threshold?: number;
  /** Max vertical drift (px) before the gesture is treated as scroll. */
  maxVertical?: number;
  /** Max time (ms) for a fast flick. */
  maxDuration?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Lightweight horizontal swipe detector that coexists with vertical scroll
 * and pull-to-refresh. Only fires when horizontal intent dominates.
 */
export function useHorizontalSwipe({
  threshold = 60,
  maxVertical = 50,
  maxDuration = 600,
  onSwipeLeft,
  onSwipeRight,
}: Options) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startT = useRef(0);
  const tracking = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      tracking.current = false;
      return;
    }
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startT.current = Date.now();
    tracking.current = true;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!tracking.current) return;
      tracking.current = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;
      const dt = Date.now() - startT.current;
      if (Math.abs(dy) > maxVertical) return;
      if (Math.abs(dx) < threshold) return;
      if (dt > maxDuration && Math.abs(dx) < threshold * 1.6) return;
      hapticImpact("light");
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    },
    [threshold, maxVertical, maxDuration, onSwipeLeft, onSwipeRight],
  );

  return { onTouchStart, onTouchEnd };
}
