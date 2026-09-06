import type { ExerciseCoaching } from "@/data/exercise-coaching";

/**
 * Coaching entries — upper body movements the generator can prescribe
 * (src/data/illustration-map.ts). Same schema and house rules as
 * exercise-coaching.ts: plain language, every mistake ships with its fix, no
 * medical claims, "use less weight" when in doubt. Keyed by illustrated slug.
 */
export const UPPER_BODY_COACHING: Record<string, ExerciseCoaching> = {};
