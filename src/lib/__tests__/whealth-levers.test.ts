// The lever map is what turns a score into an action — a broken deep link
// here is a dead end on the flagship surface. Same integrity pattern as the
// daily-insights slug test.
import { describe, it, expect } from "vitest";
import { WHEALTH_LEVERS, pickLevers } from "@/lib/whealth-levers";

const KNOWN_ROUTES = ["/vault", "/recipes", "/exercises", "/checkin", "/coach", "/coach/reflect", "/coach/profile", "/profile", "/squad"];
const KNOWN_LESSON_SLUGS = new Set([
  // Inner Work (20260811085218) + recovery course sleep lessons referenced here
  "inner-operating-system", "manifestation-demystified", "woop-mental-contrasting",
  "visualization-that-works", "elevate-your-energy", "gratitude-savoring",
  "distanced-self-talk", "authentic-self-image", "letting-go", "inner-work-recap",
  "sleep-7-9-hours",
]);

describe("WHEALTH_LEVERS integrity", () => {
  it("every pillar has ≥3 levers with title/detail/action", () => {
    for (const levers of Object.values(WHEALTH_LEVERS)) {
      expect(levers.length).toBeGreaterThanOrEqual(3);
      for (const l of levers) {
        expect(l.title.length).toBeGreaterThan(3);
        expect(l.detail.length).toBeGreaterThan(10);
        expect(l.action.label.length).toBeGreaterThan(2);
      }
    }
  });

  it("every action path is a known route; every ?lesson= slug is real", () => {
    for (const levers of Object.values(WHEALTH_LEVERS)) {
      for (const l of levers) {
        const [path, query] = l.action.path.split("?");
        expect(KNOWN_ROUTES, l.action.path).toContain(path);
        if (query?.startsWith("lesson=")) {
          expect(KNOWN_LESSON_SLUGS.has(query.slice(7)), l.action.path).toBe(true);
        }
      }
    }
  });
});

describe("pickLevers", () => {
  it("targets the weakest sub-signal first (null = weakest of all)", () => {
    const picks = pickLevers("sleep", [
      { key: "duration", score: 100 },
      { key: "consistency", score: null },
      { key: "stages", score: 40 },
    ]);
    expect(picks[0].partKey).toBe("consistency");
    expect(picks[1].partKey).toBe("stages");
  });

  it("fills from the general pool when parts don't match", () => {
    const picks = pickLevers("inner", [{ key: "unknown", score: 10 }]);
    expect(picks.length).toBe(2);
  });
});
