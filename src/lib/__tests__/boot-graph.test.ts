import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * What a cold start has to download and parse is everything reachable through
 * STATIC imports from the entry and from Home. A heavy data module slipping
 * into that graph costs every launch, silently: the 268-movement illustration
 * catalog (164 kB) came back in through TrainingZone -> FocusSessionSheet ->
 * exercise-match and nothing failed. This walks the graph and names the path.
 */
const ROOT = resolve(__dirname, "../../..");
const HEAVY = [
  "src/data/exercises-illustrated",
  "src/data/exercises.ts",
  "src/data/exercise-coaching",
  "src/data/daily-insights",
  // Recovery's movement library and routine scripts (both files by prefix).
  "src/data/recovery",
  "src/components/StoryShareModal",
  "supabase/functions/",
];

const resolveFile = (base: string): string | null => {
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
};

const staticImports = (file: string): string[] => {
  const src = readFileSync(file, "utf8");
  const out: string[] = [];
  // `import x from "y"`, `import "y"`, `export ... from "y"`; never `import("y")` and never `import type`.
  const re = /^\s*(?:import(?!\s+type\b)(?:[^"'()]*?\sfrom)?|export\s+(?!type\b)[^"']*?\sfrom)\s*["']([^"']+)["']/gm;
  for (let m = re.exec(src); m; m = re.exec(src)) out.push(m[1]);
  return out;
};

const reach = (entry: string) => {
  const seen = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    for (const spec of staticImports(file)) {
      const base = spec.startsWith("@/") ? join(ROOT, "src", spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(file), spec) : null;
      const target = base && resolveFile(base);
      if (target && !seen.has(target)) { seen.set(target, file); queue.push(target); }
    }
  }
  return seen;
};

const trail = (seen: Map<string, string | null>, file: string) => {
  const path: string[] = [];
  for (let f: string | null | undefined = file; f; f = seen.get(f)) path.unshift(f.replace(`${ROOT}/`, ""));
  return path.join(" -> ");
};

describe("the boot graph", () => {
  it.each(["src/main.tsx", "src/pages/Index.tsx"])("%s reaches no heavy module statically", (entry) => {
    const seen = reach(join(ROOT, entry));
    // A walker that silently sees nothing would pass forever: it must reach Home's own parts.
    expect(seen.size).toBeGreaterThan(40);
    if (entry.endsWith("Index.tsx")) expect(seen.has(join(ROOT, "src/components/coach/TrainingZone.tsx"))).toBe(true);
    const leaks = [...seen.keys()].filter((f) => HEAVY.some((h) => f.replace(`${ROOT}/`, "").startsWith(h))).map((f) => trail(seen, f));
    expect(leaks).toEqual([]);
  });
});
