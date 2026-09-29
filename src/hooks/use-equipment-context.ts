import { useCallback, useEffect, useState } from "react";
import { readLocal, writeLocal, removeLocal } from "@/lib/storage";
import type { ProgramBlock } from "@/hooks/use-coach-program";
import type { EquipmentValue } from "@/lib/training/equipment-context";

/** What was chosen for one day, and the day as it stood before. */
export interface EquipmentRecord {
  context: EquipmentValue[];
  /** The original blocks, written once so "back to usual" is exact. */
  snapshot: ProgramBlock[];
}

/**
 * Today's room, remembered per day.
 *
 * The substitution itself is written into plan_json, because every other
 * surface — the runner's swap, the session summary's volume, the PR check,
 * the day card's own list — reads the plan independently, and an overlay
 * would give each of them a different answer about what today is.
 *
 * What stays local is the choice and a restore snapshot. The snapshot is
 * written once, on the first substitution, so going back to the usual room
 * returns the original barbell squat rather than whatever swapping back
 * happens to land on.
 *
 * Keyed by program, week and day, the same family as `wf_rest:` and
 * `session-skipped:`, so it survives an app kill and does not leak across
 * days. readLocal/writeLocal cannot throw in a WKWebView with storage
 * disabled, which is why they exist.
 */
export const useEquipmentContext = (programId: string | null, week: number, day: number) => {
  const key = programId ? `wf_equip:${programId}:${week}:${day}` : null;
  const [record, setRecord] = useState<EquipmentRecord | null>(null);

  useEffect(() => {
    if (!key) { setRecord(null); return; }
    const raw = readLocal(key);
    if (!raw) { setRecord(null); return; }
    try {
      const parsed = JSON.parse(raw) as EquipmentRecord;
      setRecord(Array.isArray(parsed?.context) ? parsed : null);
    } catch {
      removeLocal(key);
      setRecord(null);
    }
  }, [key]);

  const save = useCallback((next: EquipmentRecord) => {
    setRecord(next);
    if (key) writeLocal(key, JSON.stringify(next));
  }, [key]);

  const clear = useCallback(() => {
    setRecord(null);
    if (key) removeLocal(key);
  }, [key]);

  return { record, save, clear };
};
