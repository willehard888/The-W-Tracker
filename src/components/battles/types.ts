import type { ElementType } from "react";

/** One entry of BATTLE_TYPES (Battles.tsx). */
export interface BattleTypeInfo {
  id?: string;
  label: string;
  emoji: string;
  description?: string;
  icon: ElementType;
  color: string;
}
