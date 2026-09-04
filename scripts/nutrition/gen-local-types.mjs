#!/usr/bin/env node
// Emit Supabase-style TypeScript types for the NUTRITION objects of a local
// Postgres (the dry-run cluster), in the exact shape `supabase gen types`
// produces, so scripts/nutrition/splice-types.mjs can merge them into
// src/integrations/supabase/types.ts. Needed because the CLI's generator
// runs inside Docker, which this machine does not have. The founder's real
// `npm run types:gen` against prod supersedes this file.
//
//   node scripts/nutrition/gen-local-types.mjs > /path/local-types.ts
//   env: PGHOST=/tmp PGPORT=5499 PGUSER=postgres PGDATABASE=wf (defaults)
import { execFileSync } from "node:child_process";

const ALLOW = /^(food_|foods$|nutrition_|nutrient_|meal_|recipe_|ingest_foods$|search_foods$|log_meal$|update_meal_item$|duplicate_meal$|daily_nutrition_totals$|upsert_(user_food|recipe|nutrition_targets)$|normalize_barcode$|f_unaccent$|sum_nutrition$|scale_nutrition$)/;

const psql = (sql) => {
  const out = execFileSync(
    process.env.PSQL ?? "psql",
    ["-h", process.env.PGHOST ?? "/tmp", "-p", process.env.PGPORT ?? "5499", "-U", process.env.PGUSER ?? "postgres", "-d", process.env.PGDATABASE ?? "wf", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8", env: { ...process.env, LANG: "C", LC_ALL: "C" } },
  ).trim();
  return out ? JSON.parse(out) : [];
};

const TS = (udt) => {
  switch (udt) {
    case "uuid": case "text": case "varchar": case "bpchar": case "date": case "timestamptz": case "timestamp": case "time": case "citext":
      return "string";
    case "int2": case "int4": case "int8": case "numeric": case "float4": case "float8": case "real":
      return "number";
    case "bool": return "boolean";
    case "json": case "jsonb": return "Json";
    case "_text": case "_uuid": case "_varchar": return "string[]";
    case "_int2": case "_int4": case "_int8": case "_numeric": return "number[]";
    case "_jsonb": case "_json": return "Json[]";
    case "void": return "undefined";
    case "record": return "Record<string, unknown>";
    default: return "unknown";
  }
};

const columns = psql(`
  select coalesce(json_agg(json_build_object(
    'table', c.table_name, 'name', c.column_name, 'udt', c.udt_name,
    'nullable', c.is_nullable = 'YES', 'has_default', c.column_default is not null,
    'generated', c.is_generated = 'ALWAYS' or c.identity_generation is not null
  ) order by c.table_name, c.column_name), '[]')
  from information_schema.columns c
  where c.table_schema = 'public'`);

const fks = psql(`
  select coalesce(json_agg(json_build_object(
    'name', con.conname,
    'table', rel.relname,
    'columns', (select array_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(attnum, ord)
                join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum),
    'ref_table', frel.relname,
    'ref_columns', (select array_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(attnum, ord)
                    join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum),
    'one_to_one', exists (select 1 from pg_constraint u where u.conrelid = con.conrelid and u.contype in ('p','u') and u.conkey = con.conkey)
  ) order by con.conname), '[]')
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace and n.nspname = 'public'
  join pg_class frel on frel.oid = con.confrelid
  where con.contype = 'f'`);

const fns = psql(`
  select coalesce(json_agg(json_build_object(
    'name', p.proname,
    'argnames', p.proargnames,
    'argmodes', p.proargmodes,
    'argtypes', (select array_agg(t.typname order by k.ord) from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality k(oid, ord) join pg_type t on t.oid = k.oid),
    'nargs', p.pronargs,
    'ndefaults', p.pronargdefaults,
    'retset', p.proretset,
    'rettype', rt.typname
  ) order by p.proname), '[]')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  join pg_type rt on rt.oid = p.prorettype`);

// ---- tables ----
const byTable = new Map();
for (const c of columns) {
  if (!ALLOW.test(c.table)) continue;
  if (!byTable.has(c.table)) byTable.set(c.table, []);
  byTable.get(c.table).push(c);
}
const fkByTable = new Map();
for (const f of fks) {
  if (!byTable.has(f.table)) continue;
  if (!fkByTable.has(f.table)) fkByTable.set(f.table, []);
  fkByTable.get(f.table).push(f);
}

const lines = [];
const L = (s) => lines.push(s);
L("export type Json =");
L("  | string");
L("  | number");
L("  | boolean");
L("  | null");
L("  | { [key: string]: Json | undefined }");
L("  | Json[]");
L("");
L("export type Database = {");
L("  public: {");
L("    Tables: {");
for (const [table, cols] of [...byTable.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  L(`      ${table}: {`);
  L("        Row: {");
  for (const c of cols) L(`          ${c.name}: ${TS(c.udt)}${c.nullable ? " | null" : ""}`);
  L("        }");
  L("        Insert: {");
  for (const c of cols) {
    if (c.generated) continue;
    L(`          ${c.name}${c.nullable || c.has_default ? "?" : ""}: ${TS(c.udt)}${c.nullable ? " | null" : ""}`);
  }
  L("        }");
  L("        Update: {");
  for (const c of cols) {
    if (c.generated) continue;
    L(`          ${c.name}?: ${TS(c.udt)}${c.nullable ? " | null" : ""}`);
  }
  L("        }");
  const rel = fkByTable.get(table) ?? [];
  if (rel.length === 0) L("        Relationships: []");
  else {
    L("        Relationships: [");
    for (const f of rel) {
      L("          {");
      L(`            foreignKeyName: "${f.name}"`);
      L(`            columns: [${f.columns.map((c) => `"${c}"`).join(", ")}]`);
      L(`            isOneToOne: ${f.one_to_one}`);
      L(`            referencedRelation: "${f.ref_table}"`);
      L(`            referencedColumns: [${f.ref_columns.map((c) => `"${c}"`).join(", ")}]`);
      L("          },");
    }
    L("        ]");
  }
  L("      }");
}
L("    }");
L("    Views: {");
L("      [_ in never]: never");
L("    }");
L("    Functions: {");
for (const f of fns.filter((f) => ALLOW.test(f.name) && f.rettype !== "trigger").sort((a, b) => a.name.localeCompare(b.name))) {
  const argtypes = f.argtypes ?? [];
  const modes = f.argmodes ?? argtypes.map(() => "i");
  const names = f.argnames ?? [];
  const inArgs = [];
  const tableCols = [];
  argtypes.forEach((t, i) => {
    const mode = modes[i] ?? "i";
    if (mode === "i" || mode === "b" || mode === "v") inArgs.push({ name: names[i] ?? `arg${i}`, type: TS(t) });
    else if (mode === "t" || mode === "o") tableCols.push({ name: names[i], type: TS(t) });
  });
  const firstDefault = inArgs.length - f.ndefaults;
  const argsTxt = inArgs.length
    ? "{ " + inArgs.map((a, i) => `${a.name}${i >= firstDefault ? "?" : ""}: ${a.type}`).join("; ") + " }"
    : "Record<PropertyKey, never>";
  let ret;
  if (tableCols.length) {
    ret = "{\n" + tableCols.sort((a, b) => a.name.localeCompare(b.name)).map((c) => `          ${c.name}: ${c.type}`).join("\n") + "\n        }" + (f.retset ? "[]" : "");
  } else {
    ret = TS(f.rettype) + (f.retset ? "[]" : "");
  }
  L(`      ${f.name}: {`);
  L(`        Args: ${argsTxt}`);
  L(`        Returns: ${ret}`);
  L("      }");
}
L("    }");
L("    Enums: {");
L("      [_ in never]: never");
L("    }");
L("    CompositeTypes: {");
L("      [_ in never]: never");
L("    }");
L("  }");
L("}");
process.stdout.write(lines.join("\n") + "\n");
console.error(`tables: ${[...byTable.keys()].join(", ")}`);
console.error(`functions: ${fns.filter((f) => ALLOW.test(f.name)).map((f) => f.name).join(", ")}`);
