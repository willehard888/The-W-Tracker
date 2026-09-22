// CHECKIN_HABITS → the Daily Check-in product note.
import {
  CHECKIN_HABITS, CORE_KEYS, OPTIONAL_XP_CAP, VERIFIED_BONUS_XP, PILLAR_LABEL,
} from "@/lib/checkin-habits";
import type { GeneratedNote } from "../types.ts";
import { paths, wikilink } from "../lib/links.ts";

const SRC = "src/lib/checkin-habits.ts";

export function generate(): GeneratedNote[] {
  const rows = CHECKIN_HABITS.map(
    (h) => `| ${h.emoji} ${h.label} | ${PILLAR_LABEL[h.pillar]} | ${h.xp} | ${h.verify ?? "—"} | ${h.core ? "✓" : ""} | ${h.note ?? ""} |`,
  );
  const body = [
    `# Daily Check-in`, "",
    `Personoitu päivittäinen check-in — sovelluksen ydinteko. Käyttäjä valitsee omat habittinsa ${CORE_KEYS.length} ydinhabitin päälle (${CORE_KEYS.join(", ")}).`,
    "",
    `- **Anti-cheat:** valinnaisten (ei-core) habittien XP-katto on **${OPTIONAL_XP_CAP}/päivä** — serveri pakottaa saman ceilingin.`,
    `- **HealthKit-varmennus:** \`verify\`-signaali antaa "Verified ✓" -merkin + **+${VERIFIED_BONUS_XP} XP** bonus.`,
    "",
    `| Habit | Pilari | XP | Verify | Core | Miksi |`,
    `|---|---|---|---|---|---|`,
    ...rows,
    "",
    `## Linkit`,
    `- ${wikilink(paths.frameworkIndex(), "Wellness Framework")}`,
    `- ${wikilink(paths.statusTiers(), "Status Tiers")}`,
  ].join("\n");

  return [{
    path: paths.checkin(),
    frontmatter: {
      title: "Daily Check-in", type: "checkin-habits",
      core_keys: CORE_KEYS, optional_xp_cap: OPTIONAL_XP_CAP, verified_bonus_xp: VERIFIED_BONUS_XP,
      tags: ["product", "checkin"],
    },
    body, source: SRC, sourceId: "daily-checkin",
  }];
}
