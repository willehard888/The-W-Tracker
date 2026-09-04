// Meal slots — the four diary sections and the clock-based default.

import type { MealSlot } from "./types";

export const MEAL_SLOTS: readonly { key: MealSlot; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

/** Slot for a local time: < 10:30 breakfast, < 15:00 lunch, < 21:00 dinner, else snack. */
export function defaultSlotForHour(h: number, m = 0): MealSlot {
  const t = h * 60 + m;
  if (t < 10 * 60 + 30) return "breakfast";
  if (t < 15 * 60) return "lunch";
  if (t < 21 * 60) return "dinner";
  return "snack";
}
