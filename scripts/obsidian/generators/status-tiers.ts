// TIER_CONFIG → the Status Tiers product note.
import { TIER_CONFIG, TIER_ORDER } from "@/lib/status-tiers";
import type { GeneratedNote } from "../types.ts";
import { paths, wikilink } from "../lib/links.ts";

const SRC = "src/lib/status-tiers.ts";

export function generate(): GeneratedNote[] {
  const rows = TIER_ORDER.map((t) => {
    const c = TIER_CONFIG[t];
    const r = c.requirements;
    const req = r.orPath
      ? `top ${r.percentile}% TAI ${r.streak}pv streak + ${r.activeDays} akt.pv`
      : r.percentile ? `top ${r.percentile}%` : "—";
    return `| ${c.emoji} ${c.label} | ${c.rank} | ${req} | ${c.unlocks.join(", ")} |`;
  });
  const body = [
    `# Status Tiers`, "",
    `Ansaittu status-tikapuu — **ei ostettavissa**. XP on jäsenyysneutraali (kaikki apin käyttäjät maksavat), joten Elite / Apex / Legend ansaitaan pelkällä suorituksella (persentiili + streak + aktiivisuus).`,
    "",
    `| Tier | Rank | Vaatimus | Unlocks |`,
    `|---|---|---|---|`,
    ...rows,
    "",
    `> Divisioonat III / II / I lisätään Operator→Apex-tikkeihin tiheämpiä ylennyksiä varten.`,
    "",
    `## Linkit`,
    `- ${wikilink(paths.checkin(), "Daily Check-in")}`,
    `- ${wikilink(paths.adrLedger(), "ADR Ledger")}`,
  ].join("\n");

  return [{
    path: paths.statusTiers(),
    frontmatter: { title: "Status Tiers", type: "status-tiers", tier_order: TIER_ORDER, tags: ["product", "gamification"] },
    body, source: SRC, sourceId: "status-tiers",
  }];
}
