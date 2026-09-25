import type { ElementType } from "react";
import { Zap, Snowflake, Dumbbell, Brain, Droplets, Flame, Footprints, Moon, Activity } from "lucide-react";

/**
 * THE 1v1 disciplines. One list for the challenge sheet, the arena, the cards
 * and the copy; the SQL CHECK in migration 20260918100000 carries the same
 * ids (a test keeps them equal). The three `verified` ones are scored from
 * the member's own Apple Health rows on the server and cannot be claimed.
 */
export interface BattleType {
  id: string;
  label: string;
  /** What wins, in one line. */
  description: string;
  icon: ElementType;
  color: string;
  /** The unit a score gap is read in: "Ahead by 120 XP." */
  unit: string;
  /** Scored from Apple Health on the server. */
  verified: boolean;
}

export const BATTLE_TYPES: readonly BattleType[] = [
  { id: "xp", label: "Total XP", description: "Most XP earned", icon: Zap, color: "text-gold", unit: "XP", verified: false },
  { id: "workout", label: "Workouts", description: "Most days trained", icon: Dumbbell, color: "text-[hsl(var(--streak-orange))]", unit: "workouts", verified: false },
  { id: "steps", label: "Steps", description: "Most steps, from Apple Health", icon: Footprints, color: "text-[hsl(var(--xp-green))]", unit: "steps", verified: true },
  { id: "sleep", label: "Sleep", description: "Most hours slept, from Apple Health", icon: Moon, color: "text-blue-400", unit: "h", verified: true },
  { id: "active_kcal", label: "Active calories", description: "Most active kcal, from Apple Health", icon: Activity, color: "text-[hsl(var(--ember))]", unit: "kcal", verified: true },
  { id: "cold_shower", label: "Cold showers", description: "Most cold-shower days", icon: Snowflake, color: "text-blue-400", unit: "showers", verified: false },
  { id: "meditation", label: "Meditation", description: "Most days meditated", icon: Brain, color: "text-ember-light", unit: "days", verified: false },
  { id: "hydration", label: "Hydration", description: "Most litres logged", icon: Droplets, color: "text-cyan-400", unit: "L", verified: false },
  { id: "streak", label: "Days checked in", description: "Most check-ins in the window", icon: Flame, color: "text-[hsl(var(--streak-orange))]", unit: "days", verified: false },
];

export const BATTLE_TYPE_IDS = BATTLE_TYPES.map((t) => t.id);

export const BATTLE_DURATIONS = [3, 7, 14, 30] as const;

export const battleTypeInfo = (id: string | null | undefined): BattleType =>
  BATTLE_TYPES.find((t) => t.id === id) ?? BATTLE_TYPES[0];

/** Health disciplines need a fresh Apple Health sync on both sides. */
export const HEALTH_SYNC_WINDOW_HOURS = 48;
