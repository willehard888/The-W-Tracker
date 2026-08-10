import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

const PULL_THRESHOLD = 80;

export function usePullRefresh(queryKeys: string[][]) {
  const queryClient = useQueryClient();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hapticTriggered = useRef(false);

  // Marks a gesture that STARTED at the top — without it, a mid-list swipe
  // reused the previous gesture's stale touchStartY and could snap the
  // indicator open when the list happened to reach the top mid-scroll.
  const pullActive = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    pullActive.current = !!scrollRef.current && scrollRef.current.scrollTop <= 0;
    hapticTriggered.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing || !pullActive.current) return;
    if (scrollRef.current && scrollRef.current.scrollTop > 0) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      const distance = Math.min(diff * 0.5, 120);
      setPullDistance(distance);

      // Haptic feedback when crossing threshold
      if (distance >= PULL_THRESHOLD && !hapticTriggered.current) {
        hapticTriggered.current = true;
        hapticImpact("medium");
      } else if (distance < PULL_THRESHOLD && hapticTriggered.current) {
        hapticTriggered.current = false;
      }
    }
  }, [isRefreshing]);

  const onTouchEnd = useCallback(async () => {
    pullActive.current = false;
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      try {
        await Promise.all(queryKeys.map(key => queryClient.invalidateQueries({ queryKey: key })));
        hapticNotification("success");
      } finally {
        // Without the finally, one rejected refetch stranded the spinner AND
        // (via the isRefreshing guard) killed pull-to-refresh for the session.
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, isRefreshing, queryClient, queryKeys]);

  return {
    scrollRef,
    pullDistance,
    isRefreshing,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    PULL_THRESHOLD,
  };
}
