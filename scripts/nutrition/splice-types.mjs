#!/usr/bin/env node
// Splice NEW public Tables/Functions entries from a locally generated Supabase
// types file into src/integrations/supabase/types.ts.
//
// Why: the nutrition migrations are applied to a throwaway local Postgres
// before the founder pushes them to prod, and the client needs the generated
// types to compile. `supabase gen types --db-url <local>` only knows the
// nutrition objects plus a few stubs, so we take only the entries whose names
// are new to the real file. The founder's later `npm run types:gen` against
// prod regenerates the whole file and supersedes this splice.
//
//   node scripts/nutrition/splice-types.mjs <local-types.ts> [--dry-run]
import { readFileSync, writeFileSync } from "node:fs";

const [, , localPath, flag] = process.argv;
if (!localPath) { console.error("usage: splice-types.mjs <local-types.ts> [--dry-run]"); process.exit(2); }
const TARGET = "src/integrations/supabase/types.ts";
const local = readFileSync(localPath, "utf8");
const target = readFileSync(TARGET, "utf8");

/** Names we are willing to import from the local schema (everything else there is a stub). */
const ALLOW = /^(food_|foods$|nutrition_|nutrient_|meal_|recipe_|ingest_foods$|search_foods$|log_meal$|update_meal_item$|duplicate_meal$|daily_nutrition_totals$|upsert_(user_food|recipe|nutrition_targets)$|normalize_barcode$|f_unaccent$|sum_nutrition$|scale_nutrition$)/;

/** Locate `<section>: {` inside `public: {` and return [start of inner, end index of the matching close brace]. */
function sectionRange(src, section) {
  const pub = src.indexOf("public: {");
  if (pub < 0) throw new Error("no public schema in " + section);
  const key = `${section}: {`;
  const start = src.indexOf(key, pub);
  if (start < 0) throw new Error(`no ${section} block`);
  let depth = 0;
  for (let i = start + key.length - 1; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return [start + key.length, i]; }
  }
  throw new Error(`unbalanced ${section} block`);
}

/** Split a block's inner text into top-level `name: {...}` entries (raw text, with indentation). */
function entries(inner) {
  const out = [];
  let i = 0;
  while (i < inner.length) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*):\s*\{/m.exec(inner.slice(i));
    if (!m) break;
    const name = m[1];
    const absStart = i + m.index;
    const braceAt = absStart + m[0].length - 1;
    let depth = 0, j = braceAt;
    for (; j < inner.length; j++) {
      if (inner[j] === "{") depth++;
      else if (inner[j] === "}") { depth--; if (depth === 0) break; }
    }
    // include a trailing newline so blocks stay line-aligned
    const end = inner.indexOf("\n", j) === -1 ? inner.length : inner.indexOf("\n", j) + 1;
    out.push({ name, text: inner.slice(absStart, end) });
    i = end;
  }
  return out;
}

let result = target;
const report = [];
for (const section of ["Tables", "Functions"]) {
  const [ls, le] = sectionRange(local, section);
  const [ts, te] = sectionRange(result, section);
  const have = new Set(entries(result.slice(ts, te)).map((e) => e.name));
  const fresh = entries(local.slice(ls, le)).filter((e) => ALLOW.test(e.name) && !have.has(e.name));
  if (fresh.length === 0) { report.push(`${section}: nothing new`); continue; }
  // The local generator indents entries at the same depth; normalise to the target's first-entry indent.
  const targetIndent = (result.slice(ts, te).match(/\n(\s+)[A-Za-z_]/) || [, "      "])[1];
  const localIndent = (local.slice(ls, le).match(/\n(\s+)[A-Za-z_]/) || [, "      "])[1];
  const reindent = (t) => (localIndent === targetIndent ? t : t.split("\n").map((l) => (l.startsWith(localIndent) ? targetIndent + l.slice(localIndent.length) : l)).join("\n"));
  const insertion = fresh.map((e) => reindent(e.text.startsWith("\n") ? e.text : "\n" + e.text)).join("").replace(/\n+$/, "\n");
  // Insert right before the section's closing brace (which sits on its own indented line).
  const closeLineStart = result.lastIndexOf("\n", te) + 1;
  result = result.slice(0, closeLineStart) + insertion.replace(/^\n/, "") + result.slice(closeLineStart);
  report.push(`${section}: +${fresh.length} (${fresh.map((e) => e.name).join(", ")})`);
}

if (flag === "--dry-run") { console.log(report.join("\n")); process.exit(0); }
writeFileSync(TARGET, result);
console.log(report.join("\n"));
console.log(`wrote ${TARGET}`);
