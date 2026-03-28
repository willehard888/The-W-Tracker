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

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      hapticTriggered.current = false;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
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
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      await Promise.all(queryKeys.map(key => queryClient.invalidateQueries({ queryKey: key })));
      hapticNotification("success");
      setIsRefreshing(false);
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
