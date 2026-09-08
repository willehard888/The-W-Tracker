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
      retry: (failureCount, error: unknown) => {
        // Don't retry what cannot fix itself: HTTP 4xx, and PostgREST /
        // Postgres codes (permission, not found, bad data). PostgrestError
        // carries `code`, never `status` — the old guard was dead for the
        // app's most common error source and retried every 401 twice.
        const e = error as { status?: number; code?: string } | null;
        if (typeof e?.status === "number" && e.status >= 400 && e.status < 500) return false;
        if (typeof e?.code === "string" && /^(PGRST|42|22|23|P0)/.test(e.code)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
