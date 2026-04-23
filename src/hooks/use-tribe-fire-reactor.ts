import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
 * Memberships change rarely — pass a stable array (e.g. memoized) to
 * avoid re-subscribing.
 */
export function useTribeFireReactor(memberIds: string[]): ReactorState {
  const [events, setEvents] = useState<FireEvent[]>([]);
  const [pulseToken, setPulseToken] = useState(0);
  const [totalDelta, setTotalDelta] = useState(0);
  const [connected, setConnected] = useState(false);
  const usernameCache = useRef<Map<string, string>>(new Map());

  // Stable signature so we only re-subscribe when membership truly changes
  const key = [...memberIds].sort().join(",");

  useEffect(() => {
    if (!memberIds.length) {
      setConnected(false);
      return;
    }

    const idSet = new Set(memberIds);
    const channel = supabase
      .channel(`tribe-fire-${key.slice(0, 40)}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload: any) => {
          const newRow = payload.new ?? {};
          const oldRow = payload.old ?? {};
          const uid = newRow.user_id as string | undefined;
          if (!uid || !idSet.has(uid)) return;
          const newStreak = Number(newRow.streak ?? 0);
          const oldStreak = Number(oldRow.streak ?? 0);
          const delta = newStreak - oldStreak;
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

    // Pre-warm username cache so first event has a label
    supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", memberIds)
      .then(({ data }) => {
        ((data as any) ?? []).forEach((p: any) => {
          if (p?.user_id && p?.username) usernameCache.current.set(p.user_id, p.username);
        });
      });

    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Auto-prune stale events
  useEffect(() => {
    if (events.length === 0) return;
    const t = setInterval(() => {
      const cutoff = Date.now() - EVENT_TTL_MS - 200;
      setEvents((prev) => prev.filter((e) => e.ts > cutoff));
    }, 400);
    return () => clearInterval(t);
  }, [events.length]);

  return { events, pulseToken, totalDelta, connected };
}
