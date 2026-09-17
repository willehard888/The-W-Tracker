import { useSyncExternalStore } from "react";
import { getReportedIds, subscribeReportedIds } from "@/lib/reported-content";

/** What this member has reported in this session, as a hook (see reported-content.ts). */
export const useReportedIds = (): ReadonlySet<string> =>
  useSyncExternalStore(subscribeReportedIds, getReportedIds, getReportedIds);
