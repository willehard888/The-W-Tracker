import { describe, it, expect } from "vitest";
import {
  collectiveStreakTier,
  collectiveTierName,
  collectiveAccent,
  collectivePalette,
  tierPalette,
  tierFlameSpeed,
  personalPalette,
  withAlpha,
  isFirestorm,
  type FlamePalette,
} from "@/lib/tribe-streak";

describe("collectiveStreakTier — ladder boundaries", () => {
  it("maps totals to the right tier at every boundary", () => {
    expect(collectiveStreakTier(0)).toBe(-1);
    expect(collectiveStreakTier(29)).toBe(-1);
    expect(collectiveStreakTier(30)).toBe(0); // Hot
    expect(collectiveStreakTier(99)).toBe(0);
    expect(collectiveStreakTier(100)).toBe(1); // Warm
    expect(collectiveStreakTier(299)).toBe(1);
    expect(collectiveStreakTier(300)).toBe(2); // On Fire
    expect(collectiveStreakTier(699)).toBe(2);
    expect(collectiveStreakTier(700)).toBe(3); // Blazing
    expect(collectiveStreakTier(1499)).toBe(3);
    expect(collectiveStreakTier(1500)).toBe(4); // Diamond
    expect(collectiveStreakTier(2999)).toBe(4);
    expect(collectiveStreakTier(3000)).toBe(5); // Legendary
    expect(collectiveStreakTier(5999)).toBe(5);
    expect(collectiveStreakTier(6000)).toBe(6); // Firestorm
  });

  it("names each tier", () => {
    expect(collectiveTierName(0)).toBe("Cold");
    expect(collectiveTierName(30)).toBe("Hot");
    expect(collectiveTierName(100)).toBe("Warm");
    expect(collectiveTierName(300)).toBe("On Fire");
    expect(collectiveTierName(700)).toBe("Blazing");
    expect(collectiveTierName(1500)).toBe("Diamond");
    expect(collectiveTierName(3000)).toBe("Legendary");
    expect(collectiveTierName(6000)).toBe("Firestorm");
  });

  it("isFirestorm only at tier 6", () => {
    expect(isFirestorm(5999)).toBe(false);
    expect(isFirestorm(6000)).toBe(true);
  });
});

describe("collectiveAccent — legacy compat lock", () => {
  // These exact strings are consumed by SplashScreen + border/text styling
  // across tribe components. Changing them is a visual-regression event —
  // this test makes that an explicit decision instead of an accident.
  it("returns the exact legacy accent per tier", () => {
    expect(collectiveAccent(6000)).toBe("hsl(195 90% 60%)");
    expect(collectiveAccent(3000)).toBe("hsl(300 75% 60%)");
    expect(collectiveAccent(1500)).toBe("hsl(190 90% 60%)");
    expect(collectiveAccent(700)).toBe("hsl(28 95% 55%)");
    expect(collectiveAccent(300)).toBe("hsl(16 92% 55%)");
    expect(collectiveAccent(100)).toBe("hsl(20 92% 56%)");
    expect(collectiveAccent(30)).toBe("hsl(14 90% 56%)");
    expect(collectiveAccent(0)).toBe("hsl(var(--muted-foreground))");
  });
});

describe("flame palettes", () => {
  const FIELDS: (keyof FlamePalette)[] = ["base", "outer", "mid", "core", "glow", "text"];

  it("every tier palette is complete (all fields non-empty hsl/transparent)", () => {
    for (let tier = -1; tier <= 6; tier++) {
      const p = tierPalette(tier);
      for (const f of FIELDS) {
        expect(p[f], `tier ${tier} field ${f}`).toBeTruthy();
        expect(
          p[f].startsWith("hsl(") || p[f] === "transparent",
          `tier ${tier} field ${f} format`,
        ).toBe(true);
      }
    }
  });

  it("tiers are visually distinct (no two tiers share an outer color)", () => {
    const outers = Array.from({ length: 7 }, (_, t) => tierPalette(t).outer);
    expect(new Set(outers).size).toBe(7);
  });

  it("top tiers break out of the orange band (cyan/magenta/plasma)", () => {
    // Hue of the outer color: tiers 0-3 are warm (<60), tiers 4-6 are not.
    const hue = (c: string) => parseInt(c.slice(4), 10);
    for (let t = 0; t <= 3; t++) expect(hue(tierPalette(t).outer)).toBeLessThan(60);
    for (let t = 4; t <= 6; t++) expect(hue(tierPalette(t).outer)).toBeGreaterThan(150);
  });

  it("collectivePalette follows the collective ladder", () => {
    expect(collectivePalette(6000)).toEqual(tierPalette(6));
    expect(collectivePalette(29)).toEqual(tierPalette(-1));
    expect(collectivePalette(29).glow).toBe("transparent");
  });

  it("personalPalette follows the personal ladder (3/7/14/30/60/100/200)", () => {
    expect(personalPalette(2)).toEqual(tierPalette(-1));
    expect(personalPalette(3)).toEqual(tierPalette(0));
    expect(personalPalette(7)).toEqual(tierPalette(1));
    expect(personalPalette(14)).toEqual(tierPalette(2));
    expect(personalPalette(30)).toEqual(tierPalette(3));
    expect(personalPalette(60)).toEqual(tierPalette(4));
    expect(personalPalette(100)).toEqual(tierPalette(5));
    expect(personalPalette(200)).toEqual(tierPalette(6));
  });
});

describe("tierFlameSpeed", () => {
  it("gets strictly faster as tiers climb", () => {
    const speeds = Array.from({ length: 7 }, (_, t) => tierFlameSpeed(t));
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeLessThan(speeds[i - 1]);
    }
    expect(tierFlameSpeed(-1)).toBe(1.85); // cold = slowest
    expect(tierFlameSpeed(6)).toBe(0.7);   // firestorm = fastest
  });
});

describe("withAlpha", () => {
  it("appends alpha to a literal hsl color", () => {
    expect(withAlpha("hsl(14 90% 56%)", 0.5)).toBe("hsl(14 90% 56% / 0.5)");
  });

  it("appends alpha to a token hsl color (the case the old regex broke on)", () => {
    expect(withAlpha("hsl(var(--muted-foreground))", 0.28)).toBe(
      "hsl(var(--muted-foreground) / 0.28)",
    );
  });

  it("passes non-hsl values through untouched", () => {
    expect(withAlpha("transparent", 0.5)).toBe("transparent");
    expect(withAlpha("#fff", 0.5)).toBe("#fff");
  });
});
