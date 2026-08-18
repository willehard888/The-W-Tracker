// Sport id → display label for edge functions. MIRRORS src/lib/sports.ts
// (Deno can't import the client lib). Only labels — XP/groups stay client-side.
// When adding a sport, add it in BOTH files.
const SPORT_LABELS: Record<string, string> = {
  walk: "Walking", run: "Running", gym: "Gym", swim: "Swimming",
  yoga: "Yoga", combat: "Thai Boxing/MMA", hiit: "HIIT", team: "Team Sports",
  cycling: "Cycling", other: "Other Sport",
  tennis: "Tennis", padel: "Padel", golf: "Golf", football: "Football",
  basketball: "Basketball", icehockey: "Ice Hockey", floorball: "Floorball",
  climbing: "Climbing", hike: "Hiking", ski: "Downhill Skiing",
  xcski: "Cross-Country Skiing", rowing: "Rowing", skate: "Skating", dance: "Dance",
};

export const sportName = (id: string | null | undefined): string | null =>
  id ? SPORT_LABELS[id] ?? id : null;

/** "2× Tennis, 1× Gym" from a list of sport ids (nulls skipped). */
export const sportBreakdown = (ids: Array<string | null | undefined>): string => {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const name = sportName(id);
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `${n}× ${name}`)
    .join(", ");
};
