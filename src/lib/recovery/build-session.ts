// Areas plus a time budget in, a recovery session out.
//
// Pure and deterministic: the same areas and the same budget always produce the
// same session, in the same order. That matters more here than variety does —
// the card on the finish screen and the session that opens when it is tapped
// are two separate renders, and they have to agree.
import {
  RECOVERY_MOVEMENTS,
  movementSeconds,
  type RecoveryArea,
  type RecoveryContext,
  type RecoveryMovement,
} from "@/data/recovery";

export type RecoveryLength = "quick" | "standard" | "deep";

/**
 * Budgets, in seconds.
 *
 * Standard is the post-workout default because it is the one that survives
 * contact with a person who is done training and wants a shower. A session
 * that would be better at twelve minutes and doesn't happen is worth nothing.
 */
export const BUDGET_SEC: Record<RecoveryLength, number> = {
  quick: 180,
  standard: 360,
  deep: 720,
};

export interface RecoverySession {
  movements: RecoveryMovement[];
  /** Sum of `movementSeconds`, both sides counted. */
  totalSec: number;
  /** The areas this session actually answers — a subset of what was asked. */
  areas: RecoveryArea[];
  length: RecoveryLength;
  /** True when no area was known, so the session is general rather than earned. */
  general: boolean;
}

/**
 * The fallback when nothing is known about the session: no logged sets, no
 * recognised exercises, first ever workout. Broad, short, and safe to hand
 * anyone — not a stand-in that pretends to be personal.
 */
const GENERAL_ORDER = [
  "cat-cow",
  "childs-pose",
  "figure-four",
  "doorway-chest",
  "supine-twist",
  "wall-calf",
  "neck-side",
  "long-exhale",
];

/** Breathing closes a session rather than competing for an area slot. */
const CLOSER_ID = "long-exhale";

const eligible = (m: RecoveryMovement, context: RecoveryContext) =>
  m.contexts.includes(context);

/**
 * One movement per area, in the order the areas were given, until the budget
 * is spent — then a second pass adds more for the areas that mattered most.
 *
 * Breadth before depth: after a full-body session, one stretch for each of four
 * areas beats four for the quadriceps, because the athlete came here to answer
 * "what did I just train" and a list of one muscle does not answer it.
 */
export function buildSession(
  areas: RecoveryArea[],
  options: { length?: RecoveryLength; context?: RecoveryContext } = {},
): RecoverySession {
  const length = options.length ?? "standard";
  const context = options.context ?? "post_workout";
  const budget = BUDGET_SEC[length];

  const pool = RECOVERY_MOVEMENTS.filter((m) => eligible(m, context));
  const closer = pool.find((m) => m.id === CLOSER_ID) ?? null;
  const chosen: RecoveryMovement[] = [];
  const taken = new Set<string>();
  let spent = 0;

  const take = (m: RecoveryMovement): boolean => {
    if (taken.has(m.id)) return false;
    const cost = movementSeconds(m);
    if (spent + cost > budget) return false;
    taken.add(m.id);
    chosen.push(m);
    spent += cost;
    return true;
  };

  if (areas.length === 0) {
    for (const id of GENERAL_ORDER) {
      const m = pool.find((x) => x.id === id);
      if (m) take(m);
    }
    return { movements: chosen, totalSec: spent, areas: [], length, general: true };
  }

  // Reserve room for the closing breath so a full budget cannot crowd it out.
  const closerCost = closer ? movementSeconds(closer) : 0;
  const bodyBudget = Math.max(0, budget - closerCost);

  const forArea = (area: RecoveryArea) =>
    pool
      .filter((m) => m.areas.includes(area) && !taken.has(m.id))
      // Prefer the movement that answers this area most directly: fewer areas
      // means less of its hold is spent somewhere the athlete didn't train.
      .sort((a, b) => a.areas.length - b.areas.length || a.id.localeCompare(b.id));

  const passes = 2;
  for (let pass = 0; pass < passes; pass++) {
    for (const area of areas) {
      if (spent >= bodyBudget) break;
      const candidate = forArea(area)[0];
      if (!candidate) continue;
      const cost = movementSeconds(candidate);
      if (spent + cost > bodyBudget) continue;
      take(candidate);
    }
  }

  if (closer) take(closer);

  const covered = areas.filter((area) => chosen.some((m) => m.areas.includes(area)));
  return { movements: chosen, totalSec: spent, areas: covered, length, general: false };
}

/** "6 min" — sessions are described in whole minutes, never in seconds. */
export const describeLength = (totalSec: number): string =>
  `${Math.max(1, Math.round(totalSec / 60))} min`;
