/**
 * Counts the two type-debt escape hatches in source text — `as any` and
 * `as never` — as CODE, not as words. The old gate shelled out to `grep`, which
 * counted "has never"/"was never" inside comments and, on Windows (no grep),
 * reported 0 for everything: the ratchet could not prove a branch added no debt.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const COMMENT_OR_STRING = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g;

/** Source with comments and string literals blanked (positions kept). */
export const stripCommentsAndStrings = (src) => src.replace(COMMENT_OR_STRING, (m) => " ".repeat(m.length));

/** { asAny, asNever } for one file's text. Word-bounded: `as anything` is not a cast. */
export const countCasts = (src) => {
  const code = stripCommentsAndStrings(src);
  return {
    asAny: (code.match(/\bas\s+any\b/g) ?? []).length,
    asNever: (code.match(/\bas\s+never\b/g) ?? []).length,
  };
};

/** Sum over every .ts/.tsx under `dir` (tests included, like the grep did). */
export const scanDir = (dir) => {
  const total = { asAny: 0, asNever: 0 };
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.tsx?$/.test(name)) continue;
      const c = countCasts(readFileSync(p, "utf8"));
      total.asAny += c.asAny;
      total.asNever += c.asNever;
    }
  };
  walk(dir);
  return total;
};
