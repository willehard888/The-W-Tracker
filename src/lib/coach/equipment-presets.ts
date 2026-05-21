/**
 * Equipment preset → fine-grained gear list translation.
 *
 * The onboarding UI now stores 4 high-level presets in
 * coach_athlete_profile.equipment[] (full_gym, home_minimal, outdoor,
 * combat_sport). The AI program generator wants a fine-grained list of
 * exercises it can prescribe, so we expand at the boundary.
 *
 * Backward-compat: if the array contains legacy strings (Barbell,
 * Dumbbells, etc.) they pass through unchanged. New rows use preset IDs.
 */

export type EquipmentPreset = "full_gym" | "home_minimal" | "outdoor" | "combat_sport";

const PRESET_EXPANSIONS: Record<EquipmentPreset, string[]> = {
  full_gym: [
    "Barbell", "Dumbbells", "Squat rack", "Bench", "Pull-up bar",
    "Cable machine", "Leg press", "Plates",
  ],
  home_minimal: [
    "Dumbbells (light-medium)", "Resistance bands", "Pull-up bar (doorway)",
    "Bodyweight only", "Yoga mat",
  ],
  outdoor: [
    "Bodyweight only", "Outdoor pull-up bar (park)", "Running shoes",
    "Hiking trails", "Open space",
  ],
  combat_sport: [
    "Heavy bag", "Speed bag", "Mats", "Boxing gloves",
    "Partner (for drilling)", "Pads",
  ],
};

const LEGACY_PASSTHROUGH = new Set([
  "Barbell", "Dumbbells", "Pull-up bar", "Bands", "Bike", "Treadmill",
  "Sauna", "Cold plunge", "Bodyweight only",
]);

/**
 * Given the raw equipment[] array from coach_athlete_profile, return a
 * flat de-duplicated list of fine-grained equipment items suitable for
 * an AI prompt context.
 */
export function expandEquipmentPresets(raw: string[] | null | undefined): string[] {
  if (!raw || raw.length === 0) return ["Bodyweight only"];
  const out = new Set<string>();
  for (const item of raw) {
    if (item in PRESET_EXPANSIONS) {
      for (const e of PRESET_EXPANSIONS[item as EquipmentPreset]) out.add(e);
    } else if (LEGACY_PASSTHROUGH.has(item)) {
      out.add(item);
    } else {
      // Unknown — pass through verbatim (user may have edited freeform).
      out.add(item);
    }
  }
  return [...out];
}

/** Human label for a preset ID, used in summary views. */
export function presetLabel(id: string): string {
  switch (id) {
    case "full_gym":     return "Full gym";
    case "home_minimal": return "Home minimal";
    case "outdoor":      return "Outdoor / running";
    case "combat_sport": return "Combat / sport gym";
    default:             return id;
  }
}
