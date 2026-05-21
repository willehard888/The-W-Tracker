/**
 * Free-tier "Today's Move" picker.
 *
 * Returns the single best protocol to recommend the user *right now*,
 * computed entirely client-side from the PROTOCOLS catalog — no AI
 * call, no edge function, no failure mode.
 *
 * Selection logic (in order):
 *   1. Filter to user's WEAKEST pillar (pillar with fewest active habits).
 *      If the user has zero habits, default to "sleep" (universal lever).
 *   2. Filter to current TIME-OF-DAY window where possible.
 *      Falls back to "anytime"-tagged protocols if nothing matches.
 *   3. Prefer evidence: "strong" > "promising" > "speculative".
 *   4. Prefer NOT-YET-ADOPTED protocols (don't recommend something the
 *      user is already tracking).
 *   5. Deterministic by date so the same user sees the same suggestion
 *      all day — but it rotates daily. Avoids "another random idea" feel.
 *
 * Returns null only in the unreachable case where PROTOCOLS is empty.
 */

import {
  PROTOCOLS,
  type PillarId,
  type Protocol,
  type EvidenceTier,
} from "@/lib/wellness-framework";

export type TimeOfDay = "morning" | "midday" | "evening";

export function currentTimeOfDay(now: Date = new Date()): TimeOfDay {
  const h = now.getHours();
  if (h < 11) return "morning";
  if (h < 17) return "midday";
  return "evening";
}

/** Pillar with the fewest active habits. Ties broken by canonical order. */
export function findWeakestPillar(
  activeProtocolIds: string[],
  allPillars: PillarId[] = ["sleep", "movement", "nutrition", "stress", "recovery", "connection"],
): PillarId {
  const counts: Record<PillarId, number> = {
    sleep: 0, movement: 0, nutrition: 0, stress: 0, recovery: 0, connection: 0,
  };
  for (const id of activeProtocolIds) {
    const p = PROTOCOLS.find((x) => x.id === id);
    if (p) counts[p.pillar] += 1;
  }
  // Lowest count wins; on tie, earliest in allPillars wins.
  let winner: PillarId = allPillars[0];
  let min = counts[winner];
  for (const pillar of allPillars) {
    if (counts[pillar] < min) {
      min = counts[pillar];
      winner = pillar;
    }
  }
  return winner;
}

const EVIDENCE_RANK: Record<EvidenceTier, number> = {
  strong: 0,
  promising: 1,
  speculative: 2,
};

/** Day-stable seed so rotation is deterministic per-day per-pillar. */
function dailySeed(date: Date, pillar: PillarId): number {
  const d = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${pillar}`;
  let h = 0;
  for (let i = 0; i < d.length; i++) {
    h = ((h << 5) - h + d.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface PickFreeMoveOptions {
  /** Protocol IDs the user has already adopted as habits. */
  activeProtocolIds?: string[];
  /** Override the current time (for tests/SSR). */
  now?: Date;
}

export interface PickedMove {
  protocol: Protocol;
  reason: string;
  pillar: PillarId;
  timeOfDay: TimeOfDay;
}

export function pickFreeTierMove(opts: PickFreeMoveOptions = {}): PickedMove | null {
  if (PROTOCOLS.length === 0) return null;
  const now = opts.now ?? new Date();
  const tod = currentTimeOfDay(now);
  const active = opts.activeProtocolIds ?? [];
  const pillar = findWeakestPillar(active);

  // Eligible = same pillar, NOT-already-adopted.
  const sameP = PROTOCOLS.filter(
    (p) => p.pillar === pillar && !active.includes(p.id),
  );

  // Time-of-day filter — match exact OR "anytime".
  const timeMatch = sameP.filter((p) => {
    const t = p.dose.time_of_day ?? "anytime";
    return t === tod || t === "anytime";
  });

  // Fallback chain: time match → same pillar → any new protocol → any protocol.
  const tier1 = timeMatch.length > 0 ? timeMatch : sameP;
  const tier2 = tier1.length > 0 ? tier1
    : PROTOCOLS.filter((p) => !active.includes(p.id));
  const candidates = tier2.length > 0 ? tier2 : PROTOCOLS;

  // Rank by evidence, then rotate deterministically within the top tier.
  const sorted = [...candidates].sort(
    (a, b) => EVIDENCE_RANK[a.evidence] - EVIDENCE_RANK[b.evidence],
  );
  const topEvidence = sorted[0].evidence;
  const topTier = sorted.filter((p) => p.evidence === topEvidence);
  const idx = dailySeed(now, pillar) % topTier.length;
  const protocol = topTier[idx];

  // Build a human reason string. Three patterns by data signal:
  const pillarLabel = {
    sleep: "sleep",
    movement: "movement",
    nutrition: "nutrition",
    stress: "mind",
    recovery: "recovery",
    connection: "connection",
  }[pillar];
  const todLabel = { morning: "morning", midday: "midday", evening: "evening" }[tod];

  const reason = active.length === 0
    ? `Sleep is the universal foundation — start here, then layer the other pillars.`
    : `${pillarLabel} is your lightest pillar right now. A ${todLabel} ${pillar} habit gives you the biggest leverage.`;

  return { protocol, reason, pillar, timeOfDay: tod };
}
