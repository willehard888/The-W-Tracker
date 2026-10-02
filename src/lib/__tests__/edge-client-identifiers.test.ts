import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Two cron coaches threw a ReferenceError on every run for two weeks
 * (`supabase.from(…)` where the client was `sb`; `p.ai_consent_version` where
 * the loop variable was `profile`) and nobody saw it: the per-user try/catch
 * swallowed it, the chokepoint test only greps for the provider host, and
 * Deno bundles without a type pass. This test reads every edge function as
 * text and insists that each identifier used as a database client is
 * declared somewhere in the same file.
 */
const ROOT = join(__dirname, "../../../supabase/functions");
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!name.startsWith(".")) walk(p); } else if (p.endsWith(".ts")) files.push(p);
  }
};
walk(ROOT);

const declared = (src: string, id: string) =>
  new RegExp(`\\b(?:const|let|var)\\s+${id}\\b`).test(src) ||
  new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\b${id}\\b[^}]*\\}`).test(src) ||
  new RegExp(`\\b(?:const|let|var)\\s*\\[[^\\]]*\\b${id}\\b[^\\]]*\\]`).test(src) ||
  new RegExp(`[(,]\\s*${id}\\s*[:,)=]`).test(src) ||
  new RegExp(`\\bfor\\s*\\(\\s*const\\s+${id}\\b`).test(src) ||
  // An imported binding — in braces, default, or namespace; never the module URL ("supabase-js").
  new RegExp(`\\bimport\\s*\\{[^}]*\\b${id}\\b[^}]*\\}`).test(src) ||
  new RegExp(`\\bimport\\s+(?:\\*\\s+as\\s+)?${id}\\b`).test(src);

describe("edge functions — every database client identifier is declared", () => {
  it.each(files.map((f) => [f.replace(ROOT + "/", "")]))("%s", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    const used = new Set<string>();
    // A bare identifier before `.from(` / `.rpc(` — not a property (`log.supabase.from`,
    // `supabase.storage.from`) and not a builtin (`Array.from`).
    for (const m of src.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\.(?:from|rpc)\(/g)) used.add(m[2]);
    for (const m of src.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\.auth\.getUser\(/g)) used.add(m[2]);
    const BUILTINS = new Set(["this", "Deno", "console", "globalThis", "Array", "Uint8Array", "Int8Array", "Uint16Array", "Int32Array", "Float32Array", "Float64Array", "Buffer", "Object", "String", "Promise"]);
    const missing = [...used].filter((id) => !BUILTINS.has(id) && !declared(src, id));
    expect(missing, `${rel} uses undeclared client(s): ${missing.join(", ")}`).toEqual([]);
  });
});
