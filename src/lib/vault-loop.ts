/**
 * The practice loop's state, computed from the progress row and the private
 * reflections. Understand (completed_at) → Reflect (answer) → Practise
 * (practiced_at, server-recorded, +XP) → Integrate (answer + integrated_at).
 */
export type LoopStage = "understand" | "reflect" | "practice" | "integrate" | "done";

export const PRACTICE_XP = 15;

export interface LoopProgress {
  completed_at?: string | null;
  practiced_at?: string | null;
  integrated_at?: string | null;
}

export interface LoopState {
  understood: boolean;
  reflected: boolean;
  practiced: boolean;
  integrated: boolean;
  /** The stage the reader is on next. */
  stage: LoopStage;
  /** 0–4 stages done. */
  done: number;
}

export const loopState = (
  progress: LoopProgress | null | undefined,
  hasReflect: boolean,
  hasIntegrate: boolean,
): LoopState => {
  const understood = !!progress?.completed_at;
  const reflected = hasReflect;
  const practiced = !!progress?.practiced_at;
  const integrated = hasIntegrate || !!progress?.integrated_at;
  const stage: LoopStage = !understood
    ? "understand"
    : !reflected
      ? "reflect"
      : !practiced
        ? "practice"
        : !integrated
          ? "integrate"
          : "done";
  return {
    understood,
    reflected,
    practiced,
    integrated,
    stage,
    done: [understood, reflected, practiced, integrated].filter(Boolean).length,
  };
};

/** A piece carries the loop when it has a question in and a question out. */
export const hasLoop = (a: { reflect_prompt?: string | null; integrate_prompt?: string | null }) =>
  !!a.reflect_prompt && !!a.integrate_prompt;

/** Minutes label for a practice: "5 min", or "over the week" for multi-day work. */
export const practiceLength = (minutes: number | null | undefined) =>
  !minutes ? "a few minutes" : minutes >= 20 ? "over the week" : `${minutes} min`;

/** Which of a path's steps is next, plus how far along the walker is. */
export const pathProgress = (steps: string[], practiced: ReadonlySet<string>) => {
  const done = steps.filter((s) => practiced.has(s)).length;
  const next = steps.find((s) => !practiced.has(s)) ?? null;
  return { done, total: steps.length, next, complete: done === steps.length };
};
