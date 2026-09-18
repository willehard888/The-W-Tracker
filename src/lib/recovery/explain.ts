// One sentence saying where the session came from.
//
// The failure this exists to prevent is the ordinary one in fitness apps:
// personalisation happens, and the user never finds out. A session that was
// built from seven logged exercises looks exactly like a stock stretching video
// unless something says otherwise — so something says otherwise, once, in a
// line short enough to read without deciding to.
//
// It never says more than it knows. No percentages, no recovery score, no claim
// about the body's state. It reports what the app counted.
import type { AreaLoad } from "./exposure";
import type { RecoverySession } from "./build-session";

/** "chest, shoulders and triceps" — a list somebody would say out loud. */
export const listAreas = (areas: string[]): string => {
  if (areas.length === 0) return "";
  if (areas.length === 1) return areas[0];
  return `${areas.slice(0, -1).join(", ")} and ${areas[areas.length - 1]}`;
};

export type ExplainSource = "post_workout" | "rest_day" | "manual";

/**
 * Why this session, in one line — or null when there is nothing honest to say.
 *
 * A general session gets no explanation dressed up as one. "Built from the
 * exercises you completed" over a session built from nothing is the exact lie
 * this file exists to avoid.
 */
export function whyThis(
  source: ExplainSource,
  session: RecoverySession,
  load: AreaLoad[],
  exerciseCount?: number,
): string | null {
  if (session.general || session.areas.length === 0) {
    if (source === "rest_day") return "Nothing logged in the last two days, so this one is general.";
    if (source === "post_workout") return "No sets logged for this session, so this one is general.";
    return null;
  }

  const primary = session.primaryAreas.length ? session.primaryAreas : session.areas.slice(0, 2);

  if (source === "post_workout") {
    if (exerciseCount && exerciseCount > 0) {
      return `Built from the ${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"} you logged.`;
    }
    return `Your session put most of the load on ${listAreas(primary)}.`;
  }

  if (source === "rest_day") {
    return `${listAreas(primary)} took the most work in your last two days.`;
  }

  return `Built around ${listAreas(primary)}.`;
}

/** The one-line version for a card, where the areas are already on screen. */
export function whyThisShort(source: ExplainSource, session: RecoverySession, exerciseCount?: number): string {
  if (session.general) return "A short general session";
  if (source === "post_workout" && exerciseCount && exerciseCount > 0) {
    return `From the ${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"} you logged`;
  }
  if (source === "rest_day") return "From your last two days";
  return "Built for you";
}

/** Kept so callers importing from here do not reach into build-session for it. */
export type { AreaLoad };
