// Check-in draft persistence — the form used to be component-local only, so
// a stray tab tap (or the OS killing the WebView) lost every answer. The
// draft is per user + local day; yesterday's draft is never restored.
import { localDateStr } from "@/lib/offline-checkin";

export interface CheckinDraft {
  sleep: number;
  workoutChoice: "trained" | "rest" | null;
  sportCategory: string;
  hydration: number;
  completed: Record<string, boolean>;
  honest: boolean;
}

const key = (userId: string) => `w_checkin_draft_v1_${userId}_${localDateStr()}`;

export const loadCheckinDraft = (userId: string): CheckinDraft | null => {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return null;
    return {
      sleep: Number(d.sleep) || 8,
      workoutChoice: d.workoutChoice === "trained" || d.workoutChoice === "rest" ? d.workoutChoice : null,
      sportCategory: typeof d.sportCategory === "string" ? d.sportCategory : "none",
      hydration: Number(d.hydration) || 0,
      completed: d.completed && typeof d.completed === "object" ? d.completed : {},
      honest: d.honest === true,
    };
  } catch {
    return null;
  }
};

export const saveCheckinDraft = (userId: string, draft: CheckinDraft): void => {
  try { localStorage.setItem(key(userId), JSON.stringify(draft)); } catch { /* storage blocked */ }
};

export const clearCheckinDraft = (userId: string): void => {
  try { localStorage.removeItem(key(userId)); } catch { /* noop */ }
};
