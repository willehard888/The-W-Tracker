// Free-text injuries → tags. Lives in _shared so both the 4-week generator and
// the single-session builder read the same table.
//
// MIRRORED in src/lib/training/injuries.ts — keep in sync (parity test).
import type { InjuryTag } from "./program-safety.ts";
export type { InjuryTag };

// Matched at word START on lowercased text ("\bknee" hits "knee", "knees",
// "kneecap"; not "whiplash" → hip), so Finnish stems cover their inflections.
// MIRRORED in src/lib/training/injuries.ts — keep in sync (parity test).
export const INJURY_SYNONYMS: Record<string, InjuryTag[]> = {
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

/**
 * Free text → injury tags. Accepts the profile's text[] or one string, so
 * "Knee", "Left knee (ACL 2019)" and "polvivamma" all land on `knee`. The old
 * version needed the whole entry to equal a synonym, which the onboarding
 * chips satisfied and nothing typed by hand ever did.
 */
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
