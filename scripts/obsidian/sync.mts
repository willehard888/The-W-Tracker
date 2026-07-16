// Obsidian sync — code → second-brain notes. Idempotent, orphan-safe.
//   npm run obsidian:sync            write to $VAULT_PATH (default in config.ts)
//   npm run obsidian:check           --dry-run: print the plan, write nothing
//   npm run obsidian:sync -- --vault=/path/to/vault
import fs from "node:fs";
import { resolveVaultPath, AUTO_DIR } from "./config.ts";
import type { GeneratedNote } from "./types.ts";
import { writeNote } from "./lib/md-writer.ts";
import { readManifest, writeManifest, reconcileOrphans } from "./lib/manifest.ts";
import * as wellness from "./generators/wellness.ts";
import * as checkin from "./generators/checkin.ts";
import * as statusTiers from "./generators/status-tiers.ts";
import * as adrLedger from "./generators/adr-ledger.ts";
import * as capabilities from "./generators/capabilities.ts";
import * as changelog from "./generators/changelog.ts";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const vaultRoot = resolveVaultPath(argv, process.env);
const today = new Date().toISOString().slice(0, 10);

// Guard: allow an empty/new dir or a real vault; refuse a populated non-vault.
if (fs.existsSync(vaultRoot)) {
  const entries = fs.readdirSync(vaultRoot);
  const looksLikeVault = entries.length === 0 || entries.includes(".obsidian") || entries.includes(AUTO_DIR);
  if (!looksLikeVault) {
    console.error(`✗ Refusing: ${vaultRoot} is non-empty and doesn't look like an Obsidian vault (no .obsidian/ or Auto/).\n  Set VAULT_PATH or pass --vault=<path>.`);
    process.exit(1);
  }
} else if (!dryRun) {
  fs.mkdirSync(vaultRoot, { recursive: true });
}

const generators = [wellness, checkin, statusTiers, adrLedger, capabilities, changelog];
const notes: GeneratedNote[] = generators.flatMap((g) => g.generate());

const counts = { create: 0, update: 0, skip: 0, refuse: 0 };
for (const note of notes) {
  const { action, path: p } = writeNote(vaultRoot, note, today, dryRun);
  counts[action]++;
  if (action === "refuse") console.warn(`  ⚠ refuse (not a generated note — left untouched): ${p}`);
  else if (action !== "skip") console.log(`  ${action === "create" ? "+" : "~"} ${p}`);
}

const currentPaths = new Set(notes.map((n) => n.path));
const archived = reconcileOrphans(vaultRoot, readManifest(vaultRoot), currentPaths, today, dryRun);
for (const a of archived) console.log(`  → archived orphan: ${a}`);
writeManifest(vaultRoot, notes, dryRun);

console.log(
  `\n${dryRun ? "[dry-run] " : ""}${notes.length} notes → create ${counts.create} · update ${counts.update} · skip ${counts.skip}` +
  (counts.refuse ? ` · refuse ${counts.refuse}` : "") +
  (archived.length ? ` · archived ${archived.length}` : "") +
  `\nvault: ${vaultRoot}`,
);
