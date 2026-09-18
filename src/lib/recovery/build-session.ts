// Areas plus a budget in, a shaped recovery session out.
//
// WHY THIS HAS PHASES AND THE FIRST VERSION DID NOT
//
// The first version picked one movement per area until the budget ran out.
// Running the brief's own acceptance cases against it produced three findings
// that a passing test suite had not:
//
//   • a rest day and a post-workout session came back byte-identical, because
//     every movement carried both contexts and the filter was a no-op;
//   • "Deep" (12 min) returned the same six movements as "Standard" (6 min),
//     because the builder ran out of movements for the areas it had and
//     stopped — the library had exactly one triceps stretch;
//   • the session opened on whatever stretch sorted first, so it had no shape.
//
// A session now has an arc, and the arc differs by context:
//
//   post-workout   settle → the areas you loaded → what came along → finish
//   rest day       move → mobilise → relax
//
// The athlete is never shown that as a model. They see "6 min · chest,
// shoulders, triceps" and a list. The shape is the thing they feel, not the
// thing they read.
//
// Everything here is pure and deterministic: the card on the finish screen and
// the session it opens are two separate renders that have to agree.
import {
  RECOVERY_MOVEMENTS,
  movementSeconds,
  type RecoveryArea,
  type RecoveryContext,
  type RecoveryMovement,
} from "@/data/recovery";

export type RecoveryLength = "quick" | "standard" | "deep";

/** How the athlete says they feel. `null` is the default — nobody is asked twice. */
export type Soreness = "good" | "tight" | "sore" | null;

export type Phase = "downshift" | "primary" | "supporting" | "finish" | "move" | "mobilize" | "relax";

/**
 * Budgets, in seconds.
 *
 * Standard is the post-workout default because it is the one that survives
 * contact with someone who is done training and wants a shower. A session that
 * would be better at twelve minutes and does not happen is worth nothing.
 */
export const BUDGET_SEC: Record<RecoveryLength, number> = {
  quick: 190,
  standard: 400,
  deep: 780,
};

/** What the athlete reads above each group. Not physiology — just position. */
export const PHASE_LABEL: Record<Phase, string> = {
  downshift: "Settle",
  primary: "What you trained",
  supporting: "What came along",
  finish: "Finish",
  move: "Move",
  mobilize: "Loosen",
  relax: "Wind down",
};

export interface SessionBlock {
  phase: Phase;
  label: string;
  movements: RecoveryMovement[];
}

export interface RecoverySession {
  blocks: SessionBlock[];
  /** Flattened, in order — what the runner walks. */
  movements: RecoveryMovement[];
  /** Sum of `movementSeconds`, both sides counted. */
  totalSec: number;
  /** The areas this session actually answers — a subset of what was asked. */
  areas: RecoveryArea[];
  /** The first two, named in the copy: "Legs took most of today's load." */
  primaryAreas: RecoveryArea[];
  length: RecoveryLength;
  context: RecoveryContext;
  /** True when no area was known, so the session is general rather than earned. */
  general: boolean;
}

export interface BuildOptions {
  length?: RecoveryLength;
  context?: RecoveryContext;
  soreness?: Soreness;
  /** Standing in a gym: floor work is offered last rather than first. */
  preferStanding?: boolean;
  /**
   * How many of `areas` are "what you trained" rather than "what came along" —
   * `primaryAreaCount(load)` decides it from the measured weights. Defaults to
   * two only when the caller has no load to hand.
   */
  primaryCount?: number;
}

/**
 * The share of the body budget the primary phase may spend before supporting
 * gets its turn.
 *
 * Without this the primary block ate everything: a five-exercise pressing
 * session filled all four of its slots with chest and shoulder work and the
 * triceps — measured at weight 4 out of 6 — were never reached. Whatever
 * supporting leaves behind is handed back to primary afterwards, so the cap
 * costs no time; it only stops one phase from starving the next.
 */
const PRIMARY_SHARE = 0.7;

/**
 * How many movements each phase may hold, per length.
 *
 * This is what makes Deep genuinely deeper rather than Standard stretched: it
 * buys more positions on the SAME primary areas plus a wider supporting set,
 * not a longer hold on one stretch.
 */
const SHAPE: Record<RecoveryLength, { primary: number; supporting: number; downshift: number }> = {
  // Quick is the important one to get right: three minutes has to feel worth
  // doing, so it spends everything on the areas that were actually loaded and
  // skips the opening breath entirely.
  quick: { primary: 3, supporting: 0, downshift: 0 },
  standard: { primary: 4, supporting: 2, downshift: 1 },
  deep: { primary: 7, supporting: 4, downshift: 1 },
};

const BREATHING = ["long-exhale", "box-breathing"];

/**
 * The general session: broad, short, safe to hand anyone. Used when nothing is
 * known — first ever workout, no logged sets, no recognised exercises — and
 * honest about being general rather than dressed up as personal.
 */
const GENERAL_ORDER = [
  "cat-cow",
  "childs-pose",
  "figure-four",
  "doorway-chest",
  "supine-twist",
  "wall-calf",
  "side-bend",
  "neck-side",
];

const REST_DAY_MOVE = ["easy-walk", "shoulder-circles", "hip-circles", "leg-swings"];

const isBreathing = (m: RecoveryMovement) => m.type === "breathing";
const isLight = (m: RecoveryMovement) => m.type === "light" || m.type === "flow";

/**
 * Sore means gentler, not longer. Somebody who says they hurt gets the softer
 * positions and a shorter session — and no claim whatsoever about why they
 * hurt or what this will do about it.
 */
const sorenessBudget = (budget: number, soreness: Soreness) =>
  soreness === "sore" ? Math.round(budget * 0.7) : budget;

const allowedFor = (m: RecoveryMovement, soreness: Soreness) =>
  soreness === "sore" ? (m.intensity ?? "moderate") === "gentle" : true;

export function buildSession(
  areas: RecoveryArea[],
  options: BuildOptions = {},
): RecoverySession {
  const length = options.length ?? "standard";
  const context = options.context ?? "post_workout";
  const soreness = options.soreness ?? null;
  const shape = SHAPE[length];
  const budget = sorenessBudget(BUDGET_SEC[length], soreness);

  const pool = RECOVERY_MOVEMENTS.filter(
    (m) => m.contexts.includes(context) && allowedFor(m, soreness),
  );

  const taken = new Set<string>();
  let spent = 0;

  /** Room held for the closing breath so a full budget cannot crowd it out. */
  const closer = pool.find((m) => m.id === BREATHING[0]) ?? pool.find(isBreathing) ?? null;
  const reserve = closer ? movementSeconds(closer) : 0;

  const take = (m: RecoveryMovement, ceiling: number): boolean => {
    if (taken.has(m.id)) return false;
    const cost = movementSeconds(m);
    if (spent + cost > ceiling) return false;
    taken.add(m.id);
    spent += cost;
    return true;
  };

  /**
   * Candidates for one area, best first.
   *
   * "Best" is the movement that answers this area most directly — fewer areas
   * means less of its hold is spent somewhere the athlete did not train — and
   * then, when they are standing in a gym, the ones that do not ask them to lie
   * on the floor. Ties break by id so the same session is always the same.
   */
  const forArea = (area: RecoveryArea, preferStanding: boolean) =>
    pool
      .filter((m) => !taken.has(m.id) && m.areas.includes(area) && !isBreathing(m))
      .sort(
        (a, b) =>
          a.areas.length - b.areas.length ||
          (preferStanding ? Number(a.floor ?? false) - Number(b.floor ?? false) : 0) ||
          a.id.localeCompare(b.id),
      );

  const fill = (
    targetAreas: RecoveryArea[],
    slots: number,
    ceiling: number,
    preferStanding: boolean,
  ): RecoveryMovement[] => {
    const picked: RecoveryMovement[] = [];
    // Round-robin, not area-by-area: after a full-body session, one movement
    // for each of four areas beats four for the quadriceps, because the athlete
    // came here to answer "what did I just train" and a list of one muscle does
    // not answer it.
    for (let round = 0; picked.length < slots && round < 4; round++) {
      let progressed = false;
      for (const area of targetAreas) {
        if (picked.length >= slots) break;
        const candidate = forArea(area, preferStanding)[0];
        if (!candidate) continue;
        if (!take(candidate, ceiling)) continue;
        picked.push(candidate);
        progressed = true;
      }
      if (!progressed) break;
    }
    return picked;
  };

  const blocks: SessionBlock[] = [];
  const push = (phase: Phase, movements: RecoveryMovement[]) => {
    if (movements.length) blocks.push({ phase, label: PHASE_LABEL[phase], movements });
  };

  const general = areas.length === 0;
  const split = Math.max(1, Math.min(options.primaryCount ?? 2, areas.length));
  const primaryAreas = areas.slice(0, split);
  const supportingAreas = areas.slice(split);
  const preferStanding = options.preferStanding ?? context === "post_workout";

  if (general) {
    const picked: RecoveryMovement[] = [];
    for (const id of GENERAL_ORDER) {
      const m = pool.find((x) => x.id === id);
      if (m && take(m, budget - reserve)) picked.push(m);
      if (picked.length >= shape.primary + shape.supporting) break;
    }
    push(context === "rest_day" ? "mobilize" : "primary", picked);
  } else if (context === "rest_day") {
    // MOVE → MOBILISE → RELAX. A rest day opens with movement rather than a
    // hold, because the body has not done anything yet today.
    const move: RecoveryMovement[] = [];
    for (const id of REST_DAY_MOVE) {
      const m = pool.find((x) => x.id === id);
      // Prefer a mover that touches something recently trained; fall back to
      // the walk, which touches nothing and suits any day.
      if (!m) continue;
      const relevant = m.areas.length === 0 || m.areas.some((a) => areas.includes(a));
      if (relevant && take(m, budget - reserve)) move.push(m);
      if (move.length >= (length === "quick" ? 1 : 2)) break;
    }
    if (move.length === 0) {
      const walk = pool.find((m) => m.id === "easy-walk");
      if (walk && take(walk, budget - reserve)) move.push(walk);
    }
    push("move", move);
    push(
      "mobilize",
      fill([...primaryAreas, ...supportingAreas], shape.primary + shape.supporting, budget - reserve, false),
    );
  } else {
    // Settle → what you trained → what came along → finish.
    if (shape.downshift > 0) {
      const settle = pool.find((m) => m.id === BREATHING[1]) ?? null;
      const picked = settle && take(settle, budget - reserve) ? [settle] : [];
      push("downshift", picked);
    }
    const body = budget - reserve;
    const primaryCeiling = shape.supporting > 0 ? spent + (body - spent) * PRIMARY_SHARE : body;
    const primary = fill(primaryAreas, shape.primary, primaryCeiling, preferStanding);
    const supporting =
      shape.supporting > 0 ? fill(supportingAreas, shape.supporting, body, preferStanding) : [];
    // Whatever supporting did not need goes back to the areas that were
    // actually loaded, so the cap never costs the session time. Slots come from
    // the whole shape, not from what primary had left: a session with three
    // loaded areas and nothing supporting was finishing a minute and a half
    // under budget because it had run out of permission, not out of time.
    const spare = shape.primary + shape.supporting - primary.length - supporting.length;
    primary.push(...fill(primaryAreas, spare, body, preferStanding));
    push("primary", primary);
    push("supporting", supporting);
  }

  if (closer && take(closer, budget)) {
    push(context === "rest_day" ? "relax" : "finish", [closer]);
  }

  const movements = blocks.flatMap((b) => b.movements);
  const covered = areas.filter((area) => movements.some((m) => m.areas.includes(area)));

  return {
    blocks,
    movements,
    totalSec: spent,
    areas: covered,
    primaryAreas: primaryAreas.filter((a) => covered.includes(a)),
    length,
    context,
    general,
  };
}

/** "6 min" — sessions are described in whole minutes, never in seconds. */
export const describeLength = (totalSec: number): string =>
  `${Math.max(1, Math.round(totalSec / 60))} min`;

/**
 * A different movement for the same job.
 *
 * "Not feeling this one" is a real answer — a doorway when there is no doorway,
 * a floor when the floor is a gym floor, a shoulder that does not want that
 * particular angle. Swapping keeps the recovery target and changes the route to
 * it: the replacement has to cover the areas the original was chosen for, and
 * it must not already be in the session.
 *
 * Returns null when the library has nothing else to offer, so the caller can
 * leave the control out rather than show one that does nothing.
 */
export function swapMovement(
  session: RecoverySession,
  movement: RecoveryMovement,
  options: { context?: RecoveryContext; soreness?: Soreness } = {},
): RecoveryMovement | null {
  const context = options.context ?? session.context;
  const soreness = options.soreness ?? null;
  const inSession = new Set(session.movements.map((m) => m.id));

  const covers = (candidate: RecoveryMovement) =>
    movement.areas.length === 0
      ? candidate.type === movement.type
      : movement.areas.some((a) => candidate.areas.includes(a));

  const candidates = RECOVERY_MOVEMENTS.filter(
    (m) =>
      !inSession.has(m.id) &&
      m.contexts.includes(context) &&
      allowedFor(m, soreness) &&
      covers(m),
  );
  if (candidates.length === 0) return null;

  // Closest in cost first, so the session keeps the length it promised, then by
  // id so the same tap always gives the same answer.
  return candidates.sort(
    (a, b) =>
      Math.abs(movementSeconds(a) - movementSeconds(movement)) -
        Math.abs(movementSeconds(b) - movementSeconds(movement)) ||
      a.id.localeCompare(b.id),
  )[0];
}
