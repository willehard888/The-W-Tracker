// PROTOCOLS + PILLARS → wellness-domain notes (evidence + citations, #needs-source).
import {
  PROTOCOLS, PILLARS, EVIDENCE_META, FRAMEWORK_VERSION, protocolsByPillar,
} from "@/lib/wellness-framework";
import type { GeneratedNote } from "../types.ts";
import { paths, wikilink } from "../lib/links.ts";
import { citationNeedsSource } from "../config.ts";

const SRC = "src/lib/wellness-framework.ts";

export function generate(): GeneratedNote[] {
  const notes: GeneratedNote[] = [];

  // ── One note per protocol ──────────────────────────────────────────────
  for (const p of PROTOCOLS) {
    const meta = PILLARS[p.pillar];
    const weak = p.citations.filter(citationNeedsSource);
    const tags = [`wellness/${p.pillar}`, `evidence/${p.evidence}`];
    if (weak.length) tags.push("needs-source");

    const body: string[] = [
      `# ${p.title}`,
      "",
      `**Pillar:** ${wikilink(paths.pillar(meta.name), meta.name)} · **Evidence:** \`${EVIDENCE_META[p.evidence].label}\`` +
        (p.habit_xp_base ? ` · **Habit XP:** ${p.habit_xp_base}` : ""),
      "",
      `> ${p.benefit}`,
      "",
      `## Annos`,
      p.dose.summary,
      "",
      `## Riski / varoitus`,
      p.risk,
      "",
      `## Lähteet`,
      ...p.citations.map((c) => `- ${c}${citationNeedsSource(c) ? " `#needs-source`" : ""}`),
      "",
    ];
    if (weak.length) {
      body.push(
        `> [!warning] Lähde puuttuu tai on heikko`,
        `> ${weak.length} sitaattia ilman vuotta/DOI:ta. Älä esitä appissa lääketieteellisenä väitteenä ennen vahvistusta.`,
        "",
      );
    }
    body.push(
      `## Linkit`,
      `- ${wikilink(paths.pillar(meta.name), meta.name)}`,
      `- ${wikilink(paths.frameworkIndex(), "Wellness Framework")}`,
      `- ${wikilink(paths.checkin(), "Daily Check-in")}`,
    );

    notes.push({
      path: paths.protocol(p.pillar, p.title),
      frontmatter: {
        title: p.title, type: "protocol", pillar: p.pillar,
        evidence: p.evidence, habit_xp_base: p.habit_xp_base, tags,
      },
      body: body.join("\n"),
      source: SRC,
      sourceId: p.id,
    });
  }

  // ── One note per pillar ────────────────────────────────────────────────
  for (const meta of Object.values(PILLARS)) {
    const protos = protocolsByPillar(meta.id);
    const body = [
      `# ${meta.emoji} ${meta.name}`, "", `> ${meta.blurb}`, "",
      `## Protokollat (${protos.length})`,
      ...protos.map((p) => `- ${wikilink(paths.protocol(p.pillar, p.title), p.title)} · \`${p.evidence}\``),
      "",
      `## Linkit`,
      `- ${wikilink(paths.frameworkIndex(), "Wellness Framework")}`,
      `- ${wikilink(paths.checkin(), "Daily Check-in")}`,
    ].join("\n");
    notes.push({
      path: paths.pillar(meta.name),
      frontmatter: { title: `Pillar - ${meta.name}`, type: "pillar", pillar: meta.id, emoji: meta.emoji, tags: [`wellness/${meta.id}`] },
      body, source: SRC, sourceId: `pillar:${meta.id}`,
    });
  }

  // ── Framework index ────────────────────────────────────────────────────
  const idx = [
    `# Wellness Framework`, "",
    `Evidence-graded protocol catalog (v${FRAMEWORK_VERSION}) — ${PROTOCOLS.length} protokollaa, 6 pilaria. Ajaa daily missionit, Protocol Libraryn ja Coach-habitit.`,
    "",
  ];
  for (const meta of Object.values(PILLARS)) {
    const protos = protocolsByPillar(meta.id);
    idx.push(`## ${meta.emoji} ${wikilink(paths.pillar(meta.name), meta.name)} (${protos.length})`);
    idx.push(...protos.map((p) => `- ${wikilink(paths.protocol(p.pillar, p.title), p.title)} · \`${EVIDENCE_META[p.evidence].label}\``));
    idx.push("");
  }
  idx.push(`## Linkit`, `- ${wikilink(paths.checkin(), "Daily Check-in")}`, `- ${wikilink(paths.statusTiers(), "Status Tiers")}`);
  notes.push({
    path: paths.frameworkIndex(),
    frontmatter: { title: "Wellness Framework", type: "domain-index", framework_version: FRAMEWORK_VERSION, tags: ["wellness", "index"] },
    body: idx.join("\n"), source: SRC, sourceId: "framework-index",
  });

  return notes;
}
