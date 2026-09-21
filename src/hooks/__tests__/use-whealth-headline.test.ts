import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const state = vi.hoisted(() => ({
  snapshots: undefined as { snapshotDate: string; overall: number | null }[] | undefined,
  live: undefined as { overall: number | null } | undefined,
}));
vi.mock("@/hooks/use-whealth-snapshots", () => ({ useWhealthSnapshots: () => ({ data: state.snapshots }) }));
vi.mock("@/hooks/use-live-whealth-index", () => ({ useLiveWhealthIndex: () => ({ data: state.live }) }));

import { useWhealthHeadline } from "@/hooks/use-whealth-headline";

// newest first, the way the snapshots hook returns them
const NIGHTS = [
  { snapshotDate: "2026-09-20", overall: 82 },
  { snapshotDate: "2026-09-19", overall: null },
  { snapshotDate: "2026-09-01", overall: 60 },
];

describe("useWhealthHeadline", () => {
  it("leads with the live score and ends the line on it", () => {
    state.snapshots = NIGHTS;
    state.live = { overall: 56 };
    const { result } = renderHook(() => useWhealthHeadline());
    expect(result.current).toMatchObject({ overall: 56, live: true, priorOverall: 60 });
    expect(result.current.history).toEqual([60, 82, 56]);
  });

  it("falls back to last night's row when nothing is live", () => {
    state.snapshots = NIGHTS;
    state.live = undefined;
    const { result } = renderHook(() => useWhealthHeadline());
    expect(result.current).toMatchObject({ overall: 82, live: false });
    expect(result.current.history).toEqual([60, 82]);
  });

  it("has no number and no comparison on day zero", () => {
    state.snapshots = [];
    state.live = { overall: null };
    const { result } = renderHook(() => useWhealthHeadline());
    expect(result.current).toMatchObject({ overall: null, live: false, priorOverall: undefined, priorDate: undefined });
    expect(result.current.history).toEqual([]);
  });
});
