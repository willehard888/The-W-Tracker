import { QueryClient } from "@tanstack/react-query";

// Shared singleton so non-React modules (e.g. AuthContext.signOut) can clear
// the cache on logout — a shared device must not leak the previous user's
// cached profile/feed/tribe data to the next.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tiered freshness: 2 min default so back-navigation within a session
      // reuses cache instead of refetching. Volatile/realtime-backed queries
      // override with a shorter staleTime; static catalogs use a longer one.
      staleTime: 120_000,
      gcTime: 30 * 60_000,
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx (auth/not-found errors)
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
