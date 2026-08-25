import { describe, it, expect } from "vitest";
import {
  normalizeExerciseName,
  candidatesForName,
  bestTokenSubsetSlug,
  EXERCISE_ALIASES,
} from "../exercise-match";
import { groupFromMuscles, groupFromName, resolveGroup } from "../exercise-group";
import { EXERCISES, findSlugByName } from "@/data/exercises";

describe("exercise name matching", () => {
  it("normalization strips parens and punctuation", () => {
    expect(normalizeExerciseName("Seated Calf Raise (Machine)")).toBe("seated calf raise");
    expect(normalizeExerciseName("Bent-Over Row")).toBe("bent over row");
  });

  it("candidates include the paren-stripped form and aliases", () => {
    expect(candidatesForName("Barbell Back Squat")).toContain("Barbell Squat");
    expect(candidatesForName("Seated Calf Raise (Machine)")).toContain("Barbell Seated Calf Raise");
    expect(candidatesForName("RDL")).toContain("Romanian Deadlift");
  });

  it("every alias target exists in the library verbatim", () => {
    const names = new Set(Object.values(EXERCISES).map((e) => e.name));
    for (const target of Object.values(EXERCISE_ALIASES)) {
      expect(names.has(target), `alias target missing: ${target}`).toBe(true);
    }
  });

  it("token-subset fallback finds Barbell Squat for Barbell Back Squat", () => {
    const byNorm = new Map<string, string>();
    for (const [slug, ex] of Object.entries(EXERCISES)) byNorm.set(normalizeExerciseName(ex.name), slug);
    const slug = bestTokenSubsetSlug("Barbell Back Squat", byNorm);
    expect(slug).toBeTruthy();
    expect(EXERCISES[slug!].name).toBe("Barbell Squat");
    // Requires ≥2 shared tokens — a bare "Barbell" query matches nothing.
    expect(bestTokenSubsetSlug("Barbell", byNorm)).toBeNull();
  });

  it("exact names still resolve through the library's own map", () => {
    expect(findSlugByName("Face Pull")).toBeTruthy();
  });
});

describe("exercise group resolution (branded tiles)", () => {
  it("library muscles win", () => {
    expect(groupFromMuscles(["quadriceps"])).toBe("legs");
    expect(groupFromMuscles(["middle back"])).toBe("back");
    expect(groupFromMuscles(["unknown muscle"])).toBeNull();
  });
  it("name fallback covers program-speak", () => {
    expect(groupFromName("Barbell Back Squat")).toBe("legs");
    expect(groupFromName("Hanging Leg Raise")).toBe("core");
    expect(groupFromName("12-min easy bike (Zone 2)")).toBe("conditioning");
    expect(groupFromName("Bent-Over Row")).toBe("back");
    expect(groupFromName("Mystery Movement")).toBe("full");
  });
  it("resolveGroup prefers muscles over name", () => {
    expect(resolveGroup("Barbell Row", ["shoulders"])).toBe("shoulders");
    expect(resolveGroup("Barbell Row", null)).toBe("back");
  });
});

describe("illustrated library (Everkinetic)", () => {
  it("generated data is valid: unique slugs, steps and idNum everywhere", async () => {
    const { ILLUSTRATED_EXERCISES } = await import("@/data/exercises-illustrated");
    expect(ILLUSTRATED_EXERCISES.length).toBeGreaterThan(250);
    const slugs = new Set(ILLUSTRATED_EXERCISES.map((e) => e.slug));
    expect(slugs.size).toBe(ILLUSTRATED_EXERCISES.length);
    for (const e of ILLUSTRATED_EXERCISES) {
      expect(e.idNum).toMatch(/^\d{4}$/);
      expect(e.steps.length).toBeGreaterThan(0);
      expect(e.title.length).toBeGreaterThan(2);
    }
  });

  it("finds common program names", async () => {
    const { findIllustrated, illustrationUrl } = await import("@/data/exercises-illustrated");
    expect(findIllustrated("Bench Press")).toBeTruthy();
    expect(findIllustrated("bench-press")).toBeTruthy(); // slug form normalizes to the title
    const bp = findIllustrated("Bench Press")!;
    expect(illustrationUrl(bp.idNum, "tension")).toContain(`${bp.idNum}-tension.svg`);
  });

  it("image helpers: bundled thumb path + rasterized proxy URL", async () => {
    const { illustrationThumb, illustrationImg } = await import("@/data/exercises-illustrated");
    expect(illustrationThumb("0042")).toBe("/illustrations/0042.webp");
    const img = illustrationImg("0042", "relaxation", 480);
    expect(img).toContain("images.weserv.nl");
    expect(img).toContain("w=480");
    expect(img).toContain(encodeURIComponent("0042-relaxation.svg"));
  });
});
