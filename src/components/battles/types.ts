import type { ElementType } from "react";

/** One entry of BATTLE_TYPES (BattleChallengeModal.tsx). */
export interface BattleTypeInfo {
  id?: string;
  label: string;
  description?: string;
  icon: ElementType;
  color: string;
  /** The unit a score gap is read in: "Ahead by 260 XP." */
  unit: string;
}
