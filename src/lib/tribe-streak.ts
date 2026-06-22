/**
 * Helpers for computing a tribe's *collective* streak — the sum of every
 * active member's current streak. Used to drive the cinematic flame on
 * tribe headers and list rows.
 */

import { supabase } from "@/integrations/supabase/client";

/** Map a collective streak total to the 0–6 tier ladder. Tier 6 = Firestorm (plasma ceiling). */
export const collectiveStreakTier = (total: number): number => {
  if (total >= 6000) return 6; // Firestorm
  if (total >= 3000) return 5; // Legendary
  if (total >= 1500) return 4; // Diamond
  if (total >= 700)  return 3; // Blazing
  if (total >= 300)  return 2; // On fire
  if (total >= 100)  return 1; // Warm
  if (total >= 30)   return 0; // Hot
  return -1; // Cold (no flame)
};

export const collectiveTierName = (total: number): string => {
  const t = collectiveStreakTier(total);
  return t === 6 ? "Firestorm" :
         t === 5 ? "Legendary" :
         t === 4 ? "Diamond"   :
         t === 3 ? "Blazing"   :
         t === 2 ? "On Fire"   :
         t === 1 ? "Warm"      :
         t === 0 ? "Hot"       : "Cold";
};

/** Accent color for the collective flame at each tier. */
export const collectiveAccent = (total: number): string => {
  const t = collectiveStreakTier(total);
  if (t === 6) return "hsl(195 90% 60%)"; // Firestorm — cyan plasma core
  if (t === 5) return "hsl(300 75% 60%)";
  if (t === 4) return "hsl(190 90% 60%)";
  if (t === 3) return "hsl(28 95% 55%)";
  if (t === 2) return "hsl(16 92% 55%)";
  if (t === 1) return "hsl(20 92% 56%)";
  if (t === 0) return "hsl(14 90% 56%)";
  return "hsl(var(--muted-foreground))";
};

/** Whether this collective flame is at the Firestorm (plasma) tier. */
export const isFirestorm = (total: number) => collectiveStreakTier(total) >= 6;

/**
 * Sum of every active member's `streak` for a single tribe.
 * Two queries: members → profiles. RLS-safe (read-only on public columns).
 */
export const fetchTribeCollectiveStreak = async (tribeId: string): Promise<number> => {
  const { data: members } = await supabase
    .from("tribe_members")
    .select("user_id")
    .eq("tribe_id", tribeId)
    .eq("status", "active");
  const ids = ((members as any) ?? []).map((m: any) => m.user_id as string);
  if (ids.length === 0) return 0;

  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, streak")
    .in("user_id", ids);
  return ((profs as any) ?? []).reduce(
    (sum: number, p: any) => sum + (p?.streak ?? 0),
    0,
  );
};

/**
 * Sum of every active member's streak across **every tribe a user belongs to**.
 * Drives the personal "Tribe Fire" hero on /tribes. Members shared across
 * tribes are counted once per tribe (intentional — represents their feed
 * into each fire). For a stricter "unique members" version, dedupe userIds.
 */
export const fetchUserTotalTribeHeat = async (userId: string): Promise<number> => {
  // 1. tribes the user is an active member of
  const { data: myMemberships } = await supabase
    .from("tribe_members")
    .select("tribe_id")
    .eq("user_id", userId)
    .eq("status", "active");
  const tribeIds = ((myMemberships as any) ?? []).map((m: any) => m.tribe_id as string);
  if (tribeIds.length === 0) return 0;

  // 2. all active members across those tribes
  const { data: allMembers } = await supabase
    .from("tribe_members")
    .select("user_id")
    .in("tribe_id", tribeIds)
    .eq("status", "active");
  const memberUserIds: string[] = Array.from(
    new Set(
      (((allMembers as any) ?? []) as { user_id: string }[]).map((r) => r.user_id),
    ),
  );
  if (memberUserIds.length === 0) return 0;

  // 3. sum unique members' streaks (a single user only counted once even
  //    if they're in two of the viewer's tribes — feels truer to "your fire")
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, streak")
    .in("user_id", memberUserIds);
  return ((profs as any) ?? []).reduce(
    (sum: number, p: any) => sum + (p?.streak ?? 0),
    0,
  );
};

/**
 * Batch version for the tribe list — returns a Map<tribeId, totalStreak>.
 */
export const fetchTribeCollectiveStreaks = async (
  tribeIds: string[],
): Promise<Map<string, number>> => {
  const out = new Map<string, number>();
  if (tribeIds.length === 0) return out;
  tribeIds.forEach((id) => out.set(id, 0));

  const { data: members } = await supabase
    .from("tribe_members")
    .select("tribe_id, user_id")
    .in("tribe_id", tribeIds)
    .eq("status", "active");
  const rows = ((members as any) ?? []) as { tribe_id: string; user_id: string }[];
  if (rows.length === 0) return out;

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, streak")
    .in("user_id", userIds);
  const streakMap = new Map<string, number>(
    ((profs as any) ?? []).map((p: any) => [p.user_id as string, (p?.streak ?? 0) as number]),
  );

  rows.forEach((r) => {
    out.set(r.tribe_id, (out.get(r.tribe_id) ?? 0) + (streakMap.get(r.user_id) ?? 0));
  });
  return out;
};
