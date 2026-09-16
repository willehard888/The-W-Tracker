#!/usr/bin/env node
// The Vault's content as one library, and the lint that keeps it in one voice.
//
//   node scripts/vault-content.mjs            → lint the effective library
//   node scripts/vault-content.mjs --export f → lint a live export (json array)
//   node scripts/vault-content.mjs --json     → print the effective library
//
// The effective library = scripts/vault/base.json (the live rows on
// 2026-09-16, before the rewrite) with every later content migration applied
// in file order. Those migrations use one machine-readable shape (see
// parseStatements): UPDATE … SET col = $v$…$v$ WHERE slug = '…';
// DELETE … WHERE slug IN ('…'); INSERT … VALUES ($v$…$v$, …).
// docs/VAULT_VOICE.md is the human version of the rules below.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BASE_PATH = join(ROOT, "scripts/vault/base.json");
export const MIGRATIONS_DIR = join(ROOT, "supabase/migrations");
/** Content migrations written for the machine-readable shape start here. */
export const REWRITE_FROM = "20260918110000";

/** Shelves already brought to the voice: the lint is a hard failure on these. */
export const REWRITTEN_CATEGORIES = ["wisdom", "recovery", "training", "recipes"];

export const ACRONYMS = new Set(["HRV", "RPE", "NSDR", "MBSR", "CBT", "XP", "RCT", "RCTS", "BAC", "HR", "PET", "AD", "BC", "VO", "MAX", "NLP", "PETTLEP", "WOOP", "ACT", "DNA", "BMI", "SSRI", "SSRIS", "NEAT", "HIIT", "UK", "US", "USA", "EU", "GPS", "REM", "MET", "METS", "TIPP", "TIP", "LDL", "HDL", "ATP", "CNS", "RHR", "SPO2", "II", "III", "IV", "SEAL", "SEALS", "JAMA", "MIT", "PNAS", "NHS", "WHO", "CDC", "FDA", "NASA", "TV", "PDF", "OK", "USMC", "NBA", "NFL", "UFC", "AM", "PM", "GPS", "ACSM", "PREDIMED"]);

export const BANNED_PHRASES = [
  "game-changer", "game changer", "unlock", "biohack", "life hack", "protocol stack", "in today's", "here's the thing",
  "it's important to note", "delve", "dive in", "the single biggest mistake", "the entire secret", "is the protocol",
  "rabbit hole", "on the planet", "on earth", "ever measured", "ever written",
];

export const PRODUCT_NAMES = ["Headspace", "Waking Up", "Insight Timer", "Breathwrk", "Othership", "YouTube", "Oura", "Whoop", "10 % Happier", "10% Happier", "Calm app"];

export const AMERICAN = [
  "behavior", "behavioral", "visualization", "visualize", "optimize", "optimization", "savoring", "savor", "favorite",
  "analyze", "organize", "realize", "recognize", "prioritize", "minimize", "maximize", "stabilize", "normalize", "utilize",
  "emphasize", "summarize", "categorize", "center of", "colors", "colored", "fiber", "liters", "kilometers", "meters",
  "program (", "practicing", "practiced", "counselor", "defense", "license",
];

/** One number, one owner (the plan's registry): where a phrase appears, it must carry this value. */
export const REGISTRY = [
  { name: "caffeine half-life", re: /half-life[^.]{0,40}?(\d[\d–-]*) ?h/i, want: "5–7" },
  { name: "caffeine cut-off", re: /(\d[\d–-]*) ?h(?:ours)? before (?:target )?bed/i, want: "8–10" },
  { name: "morning light window", re: /within (?:the first )?(\d+) min(?:ute)?s? of waking/i, want: "60" },
  { name: "cold weekly", re: /(\d+) minutes? (?:a|per) week of (?:total )?cold/i, want: "11" },
  { name: "deload cut", re: /volume (?:cut|reduced|down) (?:by )?(\d[\d–-]*)%/i, want: "40–50" },
  { name: "protein daily", re: /(\d[.\d–-]*) g\/kg\/day/i, want: "1.6–2.2" },
  { name: "protein per meal", re: /(\d[.\d]*) g\/kg per meal/i, want: "0.4" },
  { name: "sleep window", re: /(\d[\d.–-]*) ?h(?:ours)? in bed/i, want: "7–9" },
  { name: "bedroom temperature", re: /(\d[\d–-]*) ?°C/i, want: "17–19", only: /bedroom|room temperature/i },
];

export const TEXT_FIELDS = ["title", "subtitle", "summary", "body_md", "why_it_matters", "reflect_prompt", "integrate_prompt"];
export const ARRAY_FIELDS = ["benefits", "risks", "try_today", "key_takeaways"];

// ── Effective library ────────────────────────────────────────────────────

export const loadBase = () => JSON.parse(readFileSync(BASE_PATH, "utf8"));

export const rewriteMigrationFiles = () =>
  readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && f >= REWRITE_FROM && /vault/i.test(f))
    .sort()
    .map((f) => join(MIGRATIONS_DIR, f));

/** Split SQL into top-level statements, respecting $v$…$v$ and '…' literals. */
export const parseStatements = (sql) => {
  const out = [];
  let cur = "";
  let i = 0;
  while (i < sql.length) {
    if (sql.startsWith("--", i) && (i === 0 || sql[i - 1] === "\n")) {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }
    const dq = sql.slice(i).match(/^\$[a-z]*\$/);
    if (dq) {
      const tag = dq[0];
      const end = sql.indexOf(tag, i + tag.length);
      if (end === -1) throw new Error(`unterminated ${tag} literal`);
      cur += sql.slice(i, end + tag.length);
      i = end + tag.length;
      continue;
    }
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") break;
        j++;
      }
      cur += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (sql[i] === ";") {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      i++;
      continue;
    }
    cur += sql[i];
    i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

/** A literal: $v$text$v$ · 'text' · 123 · NULL · ARRAY[…] · $v$[…]$v$::jsonb · now() */
const parseLiteral = (raw) => {
  const s = raw.trim();
  if (/^null$/i.test(s)) return null;
  if (/^now\(\)$/i.test(s)) return undefined;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^ARRAY\[/i.test(s)) {
    const inner = s.slice(s.indexOf("[") + 1, s.lastIndexOf("]"));
    return splitTopLevel(inner).map((x) => parseLiteral(x));
  }
  const dq = s.match(/^(\$[a-z]*\$)([\s\S]*)\1(::jsonb)?$/);
  if (dq) return dq[3] ? JSON.parse(dq[2]) : dq[2];
  const sq = s.match(/^'([\s\S]*)'(::jsonb)?$/);
  if (sq) {
    const text = sq[1].replace(/''/g, "'");
    return sq[2] ? JSON.parse(text) : text;
  }
  throw new Error(`unparsed literal: ${s.slice(0, 60)}`);
};

/** Split on top-level commas (outside $v$…$v$, '…' and brackets). */
const splitTopLevel = (s) => {
  const parts = [];
  let cur = "";
  let depth = 0;
  let i = 0;
  while (i < s.length) {
    const dq = s.slice(i).match(/^\$[a-z]*\$/);
    if (dq) {
      const end = s.indexOf(dq[0], i + dq[0].length);
      cur += s.slice(i, end + dq[0].length);
      i = end + dq[0].length;
      continue;
    }
    if (s[i] === "'") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "'" && s[j + 1] === "'") { j += 2; continue; }
        if (s[j] === "'") break;
        j++;
      }
      cur += s.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (s[i] === "[" || s[i] === "(") depth++;
    if (s[i] === "]" || s[i] === ")") depth--;
    if (s[i] === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      i++;
      continue;
    }
    cur += s[i];
    i++;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
};

/** Apply one migration's statements to the library (in place semantics on a copy). */
export const applyMigrationSql = (pieces, sql, file = "migration") => {
  let lib = pieces.map((p) => ({ ...p }));
  for (const st of parseStatements(sql)) {
    if (/^UPDATE public\.vault_articles\b/i.test(st)) {
      const m = st.match(/^UPDATE public\.vault_articles\s+SET\s+([\s\S]*?)\s+WHERE slug = '([a-z0-9-]+)'$/i);
      if (!m) throw new Error(`${file}: UPDATE not in the machine shape: ${st.slice(0, 80)}`);
      const assignments = splitTopLevel(m[1]);
      const piece = lib.find((p) => p.slug === m[2]);
      if (!piece) throw new Error(`${file}: UPDATE of unknown slug ${m[2]}`);
      for (const a of assignments) {
        const eq = a.indexOf("=");
        const col = a.slice(0, eq).trim();
        const val = parseLiteral(a.slice(eq + 1));
        if (val !== undefined) piece[col] = val;
      }
    } else if (/^DELETE FROM public\.vault_articles\b/i.test(st)) {
      const m = st.match(/WHERE slug IN \(([^)]+)\)$/i);
      if (!m) throw new Error(`${file}: DELETE not in the machine shape`);
      const slugs = m[1].split(",").map((x) => x.trim().replace(/^'|'$/g, ""));
      for (const s of slugs) if (!lib.some((p) => p.slug === s)) throw new Error(`${file}: DELETE of unknown slug ${s}`);
      lib = lib.filter((p) => !slugs.includes(p.slug));
    } else if (/^INSERT INTO public\.vault_articles\b/i.test(st)) {
      const m = st.match(/^INSERT INTO public\.vault_articles\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]*?)\)\s*(?:ON CONFLICT[\s\S]*)?$/i);
      if (!m) throw new Error(`${file}: INSERT not in the machine shape`);
      const cols = m[1].split(",").map((c) => c.trim());
      const vals = splitTopLevel(m[2]).map((v) => parseLiteral(v));
      if (cols.length !== vals.length) throw new Error(`${file}: INSERT has ${cols.length} columns and ${vals.length} values`);
      const piece = Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
      if (lib.some((p) => p.slug === piece.slug)) continue; // ON CONFLICT DO NOTHING
      lib.push({ protocol: {}, benefits: [], risks: [], try_today: [], key_takeaways: [], quiz: [], references_json: [], lesson_number: null, course_role: "protocol", master_slug: null, reflect_prompt: null, integrate_prompt: null, practice_minutes: null, ...piece });
    }
    // anything else (comments, ALTER, functions) is not content
  }
  return lib;
};

export const buildEffectiveLibrary = () => {
  let lib = loadBase();
  for (const f of rewriteMigrationFiles()) lib = applyMigrationSql(lib, readFileSync(f, "utf8"), f);
  return lib;
};

// ── Lint ─────────────────────────────────────────────────────────────────

const wordsOf = (p) =>
  [p.body_md ?? "", ...(p.try_today ?? []), ...(p.key_takeaways ?? [])].join(" ").split(/\s+/).filter(Boolean).length;

const textsOf = (p) => {
  const t = [];
  for (const f of TEXT_FIELDS) if (p[f]) t.push([f, String(p[f])]);
  for (const f of ARRAY_FIELDS) for (const [i, v] of (p[f] ?? []).entries()) t.push([`${f}[${i}]`, String(v)]);
  for (const [i, q] of (p.quiz ?? []).entries()) {
    t.push([`quiz[${i}].q`, q.q ?? ""]);
    t.push([`quiz[${i}].explain`, q.explain ?? ""]);
    for (const [j, c] of (q.choices ?? []).entries()) t.push([`quiz[${i}].choices[${j}]`, c]);
  }
  return t;
};

const firstSentence = (s) => (s.match(/^[^.!?]*[.!?]/) ?? [s])[0];

/** Findings for one piece: [{ slug, field, rule, sample }]. */
export const lintPiece = (p) => {
  const out = [];
  const add = (field, rule, sample = "") => out.push({ slug: p.slug, field, rule, sample: String(sample).slice(0, 90) });

  for (const [field, text] of textsOf(p)) {
    if (text.includes("—")) add(field, "em-dash", text.match(/.{0,30}—.{0,30}/)?.[0]);
    const badEn = text.match(/(?<!\d)–|–(?!\d)/);
    if (badEn) add(field, "en-dash outside a range", text.match(/.{0,30}–.{0,30}/)?.[0]);
    if (/→|←|↑|↓/.test(text)) add(field, "arrow", text.match(/.{0,30}[→←↑↓].{0,30}/)?.[0]);
    if (/[│┌└┐┘─┴┬├┤]/.test(text)) add(field, "box drawing");
    if (/```/.test(text)) add(field, "code fence");
    if (/^\s*##/m.test(text)) add(field, "## heading", text.match(/^\s*##.*$/m)?.[0]);
    if (/^\s*\|.*\|\s*$/m.test(text)) add(field, "markdown table");
    if (/\p{Extended_Pictographic}/u.test(text)) add(field, "emoji");
    if (/\[[A-Z][a-z]+\]/.test(text)) add(field, "bracket placeholder", text.match(/\[[A-Z][a-z]+\]/)?.[0]);
    for (const w of text.match(/\b[A-Z]{3,}\b/g) ?? []) if (!ACRONYMS.has(w) && !/^\d/.test(w)) add(field, "all-caps", w);
    if (/\bVO2max\b/.test(text)) add(field, "VO2max without subscript");
    if (/\d %/.test(text)) add(field, "space before %", text.match(/.{0,20}\d %.{0,10}/)?.[0]);
    if (/\d°C/.test(text)) add(field, "no space before °C", text.match(/.{0,20}\d°C/)?.[0]);
    for (const ph of BANNED_PHRASES) if (text.toLowerCase().includes(ph)) add(field, "banned phrase", ph);
    for (const pn of PRODUCT_NAMES) if (text.includes(pn)) add(field, "product name", pn);
    for (const am of AMERICAN) if (new RegExp(`\\b${am.replace(/[()]/g, "\\$&")}`, "i").test(text)) add(field, "american spelling", am);
    for (const r of REGISTRY) {
      if (r.only && !r.only.test(text)) continue;
      const m = text.match(r.re);
      if (m && m[1].replace(/-/g, "–") !== r.want) add(field, `registry: ${r.name}`, `${m[1]} (want ${r.want})`);
    }
  }
  if (p.title && p.title.includes("&")) add("title", "ampersand in title", p.title);
  if (!p.why_it_matters) add("why_it_matters", "missing");
  if (!(p.risks ?? []).length) add("risks", "missing");
  if (!(p.try_today ?? []).length) add("try_today", "missing");
  if (!(p.key_takeaways ?? []).length) add("key_takeaways", "missing");
  if (!p.reflect_prompt) add("reflect_prompt", "missing");
  if (!p.integrate_prompt) add("integrate_prompt", "missing");
  if (!p.practice_minutes || p.practice_minutes < 3) add("practice_minutes", "missing");
  if (p.summary) {
    const first = firstSentence(p.summary);
    if (first.length > 140) add("summary", "first sentence over 140 chars", first);
  }
  const quiz = p.quiz ?? [];
  if (quiz.length < 2 || quiz.length > 3) add("quiz", `has ${quiz.length} questions, want 2–3`);
  for (const [i, q] of quiz.entries()) {
    if ((q.choices ?? []).length !== 3) add(`quiz[${i}]`, "not 3 choices");
    if (!(q.correct >= 0 && q.correct < (q.choices ?? []).length)) add(`quiz[${i}]`, "correct out of range");
    if (!q.explain) add(`quiz[${i}]`, "no explain");
  }
  const refs = p.references_json ?? [];
  if (refs.length < 2) add("references_json", `only ${refs.length}`);
  if (p.master_slug && !refs.some((r) => r.author === "Note")) add("references_json", "no Note row for a master piece");
  for (const m of (p.body_md ?? "").matchAll(/([A-Z][\w'’-]+)(?: (?:&|and) [A-Z][\w'’-]+| et al\.)? \((\d{4})\)/g)) {
    const [, name, year] = m;
    if (!refs.some((r) => String(r.author ?? "").includes(name) && String(r.year) === year)) add("body_md", "citation without reference", `${name} (${year})`);
  }
  const expected = Math.max(1, Math.ceil(wordsOf(p) / 200));
  if (Math.abs((p.read_time_min ?? 0) - expected) > 1) add("read_time_min", `is ${p.read_time_min}, words say ${expected}`);
  return out;
};

/** Cross-piece rules: 12-word duplicates and quiz-index spread per shelf. */
export const lintLibrary = (pieces) => {
  const out = pieces.flatMap(lintPiece);
  const shingles = new Map();
  for (const p of pieces) {
    const words = (p.body_md ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    const seen = new Set();
    for (let i = 0; i + 12 <= words.length; i++) {
      const s = words.slice(i, i + 12).join(" ");
      if (seen.has(s)) continue;
      seen.add(s);
      const owner = shingles.get(s);
      if (owner && owner !== p.slug) out.push({ slug: p.slug, field: "body_md", rule: "12 words shared", sample: `with ${owner}: ${s.slice(0, 60)}` });
      else shingles.set(s, p.slug);
    }
  }
  const byCat = new Map();
  for (const p of pieces) {
    const c = byCat.get(p.category_id) ?? { total: 0, idx: [0, 0, 0] };
    for (const q of p.quiz ?? []) { c.total++; c.idx[q.correct] = (c.idx[q.correct] ?? 0) + 1; }
    byCat.set(p.category_id, c);
  }
  for (const [cat, c] of byCat) {
    if (c.total >= 6 && Math.max(...c.idx) / c.total > 0.6) {
      out.push({ slug: `(${cat})`, field: "quiz", rule: "correct index share over 60% on one option", sample: c.idx.join("/") });
    }
  }
  return out;
};

export const summarize = (findings) => {
  const byRule = new Map();
  for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);
  return [...byRule.entries()].sort((a, b) => b[1] - a[1]);
};

// ── CLI ──────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const exportIdx = args.indexOf("--export");
  const pieces = exportIdx >= 0 ? JSON.parse(readFileSync(args[exportIdx + 1], "utf8")) : buildEffectiveLibrary();
  if (args.includes("--json")) {
    process.stdout.write(JSON.stringify(pieces, null, 1));
    process.exit(0);
  }
  const findings = lintLibrary(pieces);
  const byCat = new Map();
  for (const f of findings) {
    const cat = pieces.find((p) => p.slug === f.slug)?.category_id ?? f.slug;
    byCat.set(cat, (byCat.get(cat) ?? 0) + 1);
  }
  console.log(`${pieces.length} pieces, ${findings.length} findings`);
  for (const [cat, n] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${cat}: ${n}`);
  console.log("top rules:");
  for (const [rule, n] of summarize(findings).slice(0, 15)) console.log(`  ${n} × ${rule}`);
  const hard = findings.filter((f) => REWRITTEN_CATEGORIES.includes(pieces.find((p) => p.slug === f.slug)?.category_id));
  if (args.includes("--verbose")) for (const f of findings) console.log(`${f.slug} · ${f.field} · ${f.rule} · ${f.sample}`);
  if (hard.length) {
    console.log(`\n${hard.length} findings on rewritten shelves:`);
    for (const f of hard) console.log(`  ${f.slug} · ${f.field} · ${f.rule} · ${f.sample}`);
    process.exit(1);
  }
}
