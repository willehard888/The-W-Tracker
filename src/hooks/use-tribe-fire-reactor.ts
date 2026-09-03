import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";

export interface FireEvent {
  id: string;
  userId: string;
  username?: string;
  delta: number;
  ts: number;
}

interface ReactorState {
  events: FireEvent[];
  pulseToken: number;
  totalDelta: number;
  connected: boolean;
}

const EVENT_TTL_MS = 2500;
const MAX_CONCURRENT = 4;

/**
 * Subscribe to `profiles.streak` increases for the given member IDs.
 * Each increase emits a short-lived FireEvent and bumps `pulseToken`,
 * which `TribeCollectiveFlame` uses to retrigger its intake animation.
 *
 * IMPORTANT — delta source of truth:
 * Supabase realtime delivers `payload.old` only when the table's REPLICA
 * IDENTITY is FULL. By default we get only the primary key in `old`, so
 * `oldRow.streak` is `undefined` and naïvely doing `new - 0` would emit a
 * giant phantom delta on every UPDATE (xp tick, rank refresh, anything).
 * Instead we maintain a client-side cache of last-known streak per user,
 * pre-warmed from a SELECT on mount, and compute the delta from that.
 *
 * Memberships change rarely — pass a stable array (e.g. memoized) to
 * avoid re-subscribing.
 */
export function useTribeFireReactor(memberIds: string[]): ReactorState {
  const [events, setEvents] = useState<FireEvent[]>([]);
  const [pulseToken, setPulseToken] = useState(0);
  const [totalDelta, setTotalDelta] = useState(0);
  const [connected, setConnected] = useState(false);
  const usernameCache = useRef<Map<string, string>>(new Map());
  const knownStreaks = useRef<Map<string, number>>(new Map());

  // Stable signature so we only re-subscribe when membership truly changes
  const key = [...memberIds].sort().join(",");

  useEffect(() => {
    if (!memberIds.length) {
      setConnected(false);
      return;
    }

    const idSet = new Set(memberIds);
    const channel = supabase
      .channel(uniqueChannelName("tribe-fire", key.slice(0, 40)))
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload: any) => {
          const newRow = payload.new ?? {};
          const uid = newRow.user_id as string | undefined;
          if (!uid || !idSet.has(uid)) return;

          const newStreak = Number(newRow.streak ?? 0);
          // Use our cached known streak — `payload.old` is unreliable.
          const knownStreak = knownStreaks.current.get(uid);

          // First update before pre-warm finished: just record and exit, no event.
          if (knownStreak === undefined) {
            knownStreaks.current.set(uid, newStreak);
            return;
          }

          const delta = newStreak - knownStreak;
          // Always update cache so next event has fresh baseline.
          knownStreaks.current.set(uid, newStreak);

          // No change (e.g. xp-only update) or a decrease → no fire event.
          if (delta <= 0) return;

          if (newRow.username) usernameCache.current.set(uid, newRow.username);
          const username = usernameCache.current.get(uid);

          const evt: FireEvent = {
            id: `${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            userId: uid,
            username,
            delta,
            ts: Date.now(),
          };

          setEvents((prev) => [...prev, evt].slice(-MAX_CONCURRENT));
          setPulseToken((p) => p + 1);
          setTotalDelta((t) => t + delta);
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    // Pre-warm username cache + known streak baseline so the first realtime
    // event computes a correct delta (and not "newStreak - 0").
    supabase
      .from("profiles")
      .select("user_id, username, streak")
      .in("user_id", memberIds)
      .then(({ data }) => {
        (data ?? []).forEach((p) => {
          if (!p?.user_id) return;
          if (p.username) usernameCache.current.set(p.user_id, p.username);
          knownStreaks.current.set(p.user_id, Number(p.streak ?? 0));
        });
      });

    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Auto-prune stale events.
  // Return the previous array unchanged when nothing is filtered out —
  // this keeps events.length stable and avoids recreating the interval
  // unnecessarily on every tick that doesn't actually prune anything.
  useEffect(() => {
    if (events.length === 0) return;
    const t = setInterval(() => {
      const cutoff = Date.now() - EVENT_TTL_MS - 200;
      setEvents((prev) => {
        const next = prev.filter((e) => e.ts > cutoff);
        return next.length !== prev.length ? next : prev;
      });
    }, 400);
    return () => clearInterval(t);
  }, [events.length]);

  return { events, pulseToken, totalDelta, connected };
}
