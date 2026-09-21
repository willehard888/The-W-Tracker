import { useMemo } from "react";
import { useWhealthSnapshots } from "@/hooks/use-whealth-snapshots";
import { useLiveWhealthIndex } from "@/hooks/use-live-whealth-index";
import { fmtDate } from "@/lib/format";

/**
 * The Whealth Index as a headline: today's value, where it stood at the start
 * of the window, and the line between them.
 *
 * One reader for Journey's hero and Progress's summary. Progress used to read
 * the same nightly table on its own and call it "Performance score" — a second
 * name and, because it skipped the live computation, a second value (82 there
 * against 56 on Journey, the same evening).
 */
export const useWhealthHeadline = () => {
  const { data: snapshots } = useWhealthSnapshots(28);
  const { data: liveIndex } = useLiveWhealthIndex();

  return useMemo(() => {
    const latest = snapshots?.[0];
    const prior = snapshots && snapshots.length > 1 ? snapshots[snapshots.length - 1] : undefined;
    const live = liveIndex?.overall != null;
    const overall = liveIndex?.overall ?? latest?.overall ?? null;
    const nightly = [...(snapshots ?? [])]
      .reverse() // oldest → newest
      .map((s) => s.overall)
      .filter((v): v is number => v != null);
    return {
      overall,
      live,
      priorOverall: prior?.overall ?? undefined,
      priorDate: prior ? fmtDate(prior.snapshotDate + "T00:00:00") : undefined,
      // The dial shows the live score, so the line ends on it: drawn from the
      // nightly rows alone it could end on a rise beside a falling number.
      history: live ? [...nightly, liveIndex!.overall!] : nightly,
    };
  }, [snapshots, liveIndex]);
};
