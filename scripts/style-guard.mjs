#!/usr/bin/env node
// Style guard — the token system's regression fence (same pattern as
// type-debt.mjs). Fails CI when a BANNED pattern re-enters src/:
//   - literal brand color triples (they were codemodded to tokens in U1)
//   - stock-Tailwind violet (off-brand in a gold/ember app)
// Canvas-drawing files are excluded: CSS var() doesn't resolve in canvas.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const EXCLUDE = new Set([
  "src/components/StoryShareModal.tsx",
  "src/components/AmbientParticles.tsx",
]);
const BANNED = [
  { re: /42[_ ]78%[_ ]54%/, msg: "literal gold — use hsl(var(--gold))" },
  { re: /18[_ ]95%[_ ]58%/, msg: "literal ember — use hsl(var(--ember))" },
  { re: /purple-[1-9]00/, msg: "stock violet — use gold/ember tokens" },
  // Type floor: nothing under 10px. 10px is reserved for .eyebrow-style micro
  // labels; body/secondary text is 11px+ (single-digit sizes are unreadable
  // on device — audited in the clarity program).
  { re: /text-\[[5-9](?:\.\d+)?px\]/, msg: "type below 10px — use text-[10px] (.eyebrow) or larger" },
];

const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(tsx?|css)$/.test(name) || EXCLUDE.has(p) || p === "src/index.css") continue;
    const src = readFileSync(p, "utf8");
    for (const b of BANNED) {
      const m = src.match(b.re);
      if (m) hits.push(`${p}: ${b.msg} (found "${m[0]}")`);
    }
  }
};
walk("src");

if (hits.length) {
  console.error("✗ Style guard: banned patterns found:\n" + hits.map((h) => "  " + h).join("\n"));
  process.exit(1);
}
console.log("✓ Style guard: no banned literal colors or sub-10px type. 👍");
