// supabase/migrations → ADR Ledger (semantic decisions table + opaque count).
import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT, isSemanticMigration, isOpaqueMigration, parseMigration, type ParsedMigration,
} from "../config.ts";
import type { GeneratedNote } from "../types.ts";
import { paths, wikilink } from "../lib/links.ts";

const SRC = "supabase/migrations/";

export function generate(): GeneratedNote[] {
  const dir = path.join(REPO_ROOT, "supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql"));
  const semantic = files
    .filter(isSemanticMigration)
    .map(parseMigration)
    .filter((m): m is ParsedMigration => m !== null)
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const opaque = files.filter(isOpaqueMigration).length;

  const body = [
    `# ADR Ledger`, "",
    `Automaattinen hakemisto **semanttisesti nimetyistä** migraatioista (= arkkitehtuuripäätöksistä). ${semantic.length} dokumentoitua · ${opaque} opaakkia (UUID-nimettyä, Lovable-ajalta) \`#needs-adr\`.`,
    "",
    `> Kirjaa iso päätös ihmis-ADR:ksi kansioon \`20_Engineering/ADR/NNN-slug.md\` ja linkitä tähän. Migraatio ei ole ADR — se on jäljki päätöksestä; "miksi" kuuluu ADR-noteen.`,
    "",
    `| Päivä | Migraatio | Aihe |`,
    `|---|---|---|`,
    ...semantic.map((m) => `| ${m.date} | \`${m.slug}\` | ${m.title} |`),
    "",
    `## Linkit`,
    `- ${wikilink(paths.capabilityMap(), "Capability Map")}`,
    `- ${wikilink(paths.statusTiers(), "Status Tiers")}`,
  ].join("\n");

  return [{
    path: paths.adrLedger(),
    frontmatter: {
      title: "ADR Ledger", type: "adr-index", source_dir: "supabase/migrations",
      documented_count: semantic.length, undocumented_count: opaque, tags: ["engineering", "adr", "index"],
    },
    body, source: SRC, sourceId: "adr-ledger",
  }];
}
