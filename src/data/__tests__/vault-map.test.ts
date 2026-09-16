import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { VAULT_MASTERS, MASTER_BY_SLUG } from "../vault-masters";
import { VAULT_PATHS, PATH_BY_SLUG, pathOfArticle, DIMENSION_LABEL } from "../vault-paths";
import { buildEffectiveLibrary } from "../../../scripts/vault-content.mjs";

/**
 * The map (masters, paths) is static TS; the pieces it points at ship via
 * migrations. Every pointer must land on a seeded slug, every master must
 * have at least one piece, and the loop columns must be filled where the
 * map expects them. Parsed straight from the migration files so a renamed
 * slug fails here, not on a member's phone.
 */
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const contentFiles = readdirSync(MIGRATIONS).filter((f) => /vault.*content|vault_articles|478cce00/.test(f) && f.endsWith(".sql"));
const sql = contentFiles.map((f) => readFileSync(join(MIGRATIONS, f), "utf8")).join("\n");

/** Every seeded slug: INSERT tuples start with ('<category>', '<slug>', */
const seededSlugs = new Set([...sql.matchAll(/^\('([a-z-]+)', '([a-z0-9-]+)',/gm)].map((m) => m[2]));

/** master_slug per slug, from both the INSERT column order and the UPDATE statements. */
const mastersFile = readFileSync(join(MIGRATIONS, "20260917100001_vault_masters_content.sql"), "utf8");
const masterOf = new Map<string, string | null>();
for (const m of mastersFile.matchAll(/UPDATE public\.vault_articles SET master_slug = (NULL|'[a-z-]+')[\s\S]*?WHERE slug = '([a-z0-9-]+)';/g)) {
  masterOf.set(m[2], m[1] === "NULL" ? null : m[1].slice(1, -1));
}
// Per-row scan for the INSERTs: the master slug is the line after course_role.
for (const row of mastersFile.split(/\n\n-- ─── /).slice(1)) {
  const slug = row.match(/^\w[^\n]*\n\('wisdom', '([a-z0-9-]+)',/)?.[1];
  const master = row.match(/,\n (NULL|'[a-z-]+'),\n '[^\n]+',\n '[^\n]+',\n \d+\)/)?.[1];
  if (slug) masterOf.set(slug, !master || master === "NULL" ? null : master.slice(1, -1));
}

describe("Vault map ↔ seeded pieces", () => {
  it("seeds at least the pieces the map needs", () => {
    // The three courses plus the masters (older seeds use a different tuple shape).
    expect(seededSlugs.size).toBeGreaterThanOrEqual(45);
  });

  it("every path step is a seeded slug, and appears in exactly one path", () => {
    const seen = new Map<string, string>();
    for (const p of VAULT_PATHS) {
      expect(p.steps.length).toBe(p.beats.length);
      expect(p.steps.length).toBeGreaterThanOrEqual(2);
      for (const s of p.steps) {
        expect(seededSlugs.has(s), `${p.slug} → ${s}`).toBe(true);
        expect(seen.has(s), `${s} in ${seen.get(s)} and ${p.slug}`).toBe(false);
        seen.set(s, p.slug);
        expect(pathOfArticle(s)?.slug).toBe(p.slug);
      }
    }
  });

  it("one path per dimension, every dimension covered", () => {
    const dims = VAULT_PATHS.map((p) => p.dimension);
    expect(new Set(dims).size).toBe(dims.length);
    for (const d of Object.keys(DIMENSION_LABEL)) expect(dims).toContain(d);
    expect(Object.keys(PATH_BY_SLUG)).toHaveLength(VAULT_PATHS.length);
  });

  it("every master has at least one piece in the effective library, and every master on a piece is on the map", () => {
    for (const [slug] of masterOf) expect(seededSlugs.has(slug), slug).toBe(true);
    // The effective library = seeds + the rewrite migrations (Robbins arrives by UPDATE-shaped INSERT).
    const byMaster = new Map<string, number>();
    for (const p of buildEffectiveLibrary()) {
      if (p.master_slug) byMaster.set(p.master_slug, (byMaster.get(p.master_slug) ?? 0) + 1);
    }
    for (const m of VAULT_MASTERS) {
      expect(byMaster.get(m.slug) ?? 0, `${m.name} has no piece`).toBeGreaterThanOrEqual(1);
    }
    for (const master of byMaster.keys()) expect(MASTER_BY_SLUG[master], master).toBeDefined();
    // Two Jung pieces: the Shadow Explorer badge needs both.
    expect(byMaster.get("jung")).toBe(2);
  });

  it("masters carry a lens, a kind and a dated work; slugs are unique", () => {
    const slugs = VAULT_MASTERS.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const m of VAULT_MASTERS) {
      expect(m.lens.length).toBeGreaterThan(20);
      expect(m.lens.length).toBeLessThanOrEqual(90);
      expect(m.works.length).toBeGreaterThan(0);
      expect(["philosophy", "psychology", "science", "practice"]).toContain(m.kind);
    }
  });

  it("every wisdom piece carries the loop: a reflect and an integrate prompt and a practice length", () => {
    const wisdomSlugs = [...sql.matchAll(/^\('wisdom', '([a-z0-9-]+)',/gm)].map((m) => m[1]);
    expect(wisdomSlugs.length).toBe(25);
    const updated = [...mastersFile.matchAll(/reflect_prompt = '([^\n]+)',\n  integrate_prompt = '([^\n]+)'\nWHERE slug = '([a-z0-9-]+)';/g)];
    expect(updated).toHaveLength(11);
    for (const [, r, i] of updated) {
      expect(r.length).toBeGreaterThan(30);
      expect(i.length).toBeGreaterThan(30);
      expect(r.endsWith("?") || r.endsWith("…")).toBe(true);
    }
    const inserted = mastersFile.split(/\n\n-- ─── /).slice(1);
    expect(inserted).toHaveLength(14);
    for (const row of inserted) {
      const tail = row.match(/,\n (NULL|'[a-z-]+'),\n '([^\n]+)',\n '([^\n]+)',\n (\d+)\)/);
      expect(tail, row.slice(0, 60)).not.toBeNull();
      expect(tail![2].length).toBeGreaterThan(30);
      expect(tail![3].length).toBeGreaterThan(30);
      expect(Number(tail![4])).toBeGreaterThanOrEqual(5);
    }
  });

  it("no quotation is attributed to a thinker (integrity rule)", () => {
    // A quote attributed to a master would look like: “...” — Name, or Name said "...".
    expect(/[“"][^”"\n]{12,}[”"]\s*[—-]\s*(Jung|Frankl|Aurelius|Epictetus|Seneca|Aristotle|Campbell|Nietzsche|Clear|Greene|Goggins|Watts|Hanh|Kabat-Zinn|Huberman|Attia)/.test(mastersFile)).toBe(false);
    expect(/(Jung|Frankl|Marcus|Epictetus|Seneca|Aristotle|Campbell|Nietzsche|Greene|Goggins|Watts|Hanh|Kabat-Zinn|Huberman|Attia) (said|wrote|says|writes)[,:]? [“"]/.test(mastersFile)).toBe(false);
  });
});
