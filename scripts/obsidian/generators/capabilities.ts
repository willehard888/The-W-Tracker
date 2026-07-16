// supabase/functions → one Capability note per edge function + a themed map.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, capabilityTheme, THEME_LABEL, type CapabilityTheme } from "../config.ts";
import type { GeneratedNote } from "../types.ts";
import { paths, wikilink } from "../lib/links.ts";

const SRC = "supabase/functions/";

/** First `// …` line comment near the top of an index.ts, as a summary. */
function firstDocComment(src: string): string {
  for (const line of src.split("\n").slice(0, 8)) {
    const m = line.match(/^\s*\/\/\s?(.+)/);
    if (m && !/eslint|@ts-/.test(m[1])) return m[1].trim();
  }
  return "";
}

export function generate(): GeneratedNote[] {
  const dir = path.join(REPO_ROOT, "supabase/functions");
  const fns = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name).sort();

  const notes: GeneratedNote[] = [];
  const byTheme = new Map<CapabilityTheme, string[]>();

  for (const fn of fns) {
    const theme = capabilityTheme(fn);
    byTheme.set(theme, [...(byTheme.get(theme) ?? []), fn]);

    let summary = "";
    let deps: string[] = [];
    try {
      const src = fs.readFileSync(path.join(dir, fn, "index.ts"), "utf8");
      summary = firstDocComment(src);
      deps = [...new Set([...src.matchAll(/_shared\/([a-z-]+)\.ts/g)].map((m) => m[1]))];
    } catch { /* fn may have no index.ts */ }

    const body = [
      `# Capability - ${fn}`, "",
      summary ? `> ${summary}` : `> _(ei doc-kommenttia index.ts:n alussa)_`,
      "",
      `**Teema:** ${THEME_LABEL[theme]}${deps.length ? ` · **_shared:** ${deps.join(", ")}` : ""}`,
      "",
      `## Linkit`,
      `- ${wikilink(paths.capabilityMap(), "Capability Map")}`,
      `- ${wikilink(paths.adrLedger(), "ADR Ledger")}`,
    ].join("\n");

    notes.push({
      path: paths.capability(fn),
      frontmatter: { title: `Capability - ${fn}`, type: "capability", function_name: fn, theme, shared_deps: deps, tags: ["engineering", `capability/${theme}`] },
      body, source: `supabase/functions/${fn}`, sourceId: `fn:${fn}`,
    });
  }

  const map = [`# Capability Map`, "", `${fns.length} edge-funktiota, ryhmiteltynä teemoittain.`, ""];
  for (const [theme, names] of [...byTheme.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    map.push(`## ${THEME_LABEL[theme]}`);
    map.push(...names.sort().map((fn) => `- ${wikilink(paths.capability(fn), fn)}`));
    map.push("");
  }
  map.push(`## Linkit`, `- ${wikilink(paths.adrLedger(), "ADR Ledger")}`, `- ${wikilink(paths.devLog(), "Dev Log")}`);
  notes.push({
    path: paths.capabilityMap(),
    frontmatter: { title: "Capability Map", type: "capability-index", function_count: fns.length, tags: ["engineering", "index"] },
    body: map.join("\n"), source: SRC, sourceId: "capability-map",
  });

  return notes;
}
