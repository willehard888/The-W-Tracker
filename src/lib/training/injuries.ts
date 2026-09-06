/**
 * Free text → injury tags, on the client.
 *
 * MIRROR of `normalizeInjuries` in
 * supabase/functions/coach-generate-program/movements.ts — keep in sync. The
 * edge function is bundled from its own folder and cannot import src/, and
 * the beginner path (written client-side, no model call) needs the same tags
 * to swap a squat for a leg press. `__tests__/injuries-parity.test.ts` runs
 * both copies over the same inputs.
 */

export type InjuryTag =
  | "lower_back" | "knee" | "shoulder" | "elbow" | "wrist" | "hip" | "neck" | "ankle";

// Matched at word START on lowercased text ("\bknee" hits "knee", "knees",
// "kneecap"; not "whiplash" → hip), so Finnish stems cover their inflections.
const INJURY_SYNONYMS: Record<string, InjuryTag[]> = {
  back: ["lower_back"],
  lumbar: ["lower_back"],
  selkä: ["lower_back"],
  alaselkä: ["lower_back"],
  lanne: ["lower_back"],
  knee: ["knee"],
  polv: ["knee"],
  shoulder: ["shoulder"],
  rotator: ["shoulder"],
  olkapä: ["shoulder"],
  kiertäjäkalvosin: ["shoulder"],
  elbow: ["elbow"],
  kyynärpä: ["elbow"],
  wrist: ["wrist"],
  ranne: ["wrist"],
  rante: ["wrist"],
  hip: ["hip"],
  lonk: ["hip"],
  neck: ["neck"],
  niska: ["neck"],
  kaula: ["neck"],
  ankle: ["ankle"],
  nilk: ["ankle"],
};

export const normalizeInjuries = (raw: string | string[] | null | undefined): Set<InjuryTag> => {
  const set = new Set<InjuryTag>();
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const item of items) {
    const text = String(item).toLowerCase();
    for (const [key, tags] of Object.entries(INJURY_SYNONYMS)) {
      if (new RegExp(`\\b${key}`).test(text)) tags.forEach((t) => set.add(t));
    }
  }
  return set;
};
