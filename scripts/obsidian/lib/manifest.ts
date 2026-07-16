// Manifest + orphan reconciliation. Entries that vanish from source are moved
// to Auto/_Archive/ (frontmatter status → orphaned), never deleted.
import fs from "node:fs";
import path from "node:path";
import { ARCHIVE_DIR, MANIFEST_PATH } from "../config.ts";
import type { GeneratedNote, ManifestEntry } from "../types.ts";
import { bodyHash } from "./md-writer.ts";

export function readManifest(vaultRoot: string): ManifestEntry[] {
  const abs = path.join(vaultRoot, MANIFEST_PATH);
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8")) as ManifestEntry[];
  } catch {
    return [];
  }
}

export function writeManifest(vaultRoot: string, notes: GeneratedNote[], dryRun: boolean): void {
  if (dryRun) return;
  const entries: ManifestEntry[] = notes.map((n) => ({
    path: n.path,
    source: n.source,
    sourceId: n.sourceId,
    hash: bodyHash(n.body),
  }));
  const abs = path.join(vaultRoot, MANIFEST_PATH);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(entries, null, 2) + "\n", "utf8");
}

/** Move a note out of the live tree into _Archive/ and stamp it orphaned. */
function archiveNote(vaultRoot: string, relPath: string, today: string, dryRun: boolean): boolean {
  const src = path.join(vaultRoot, relPath);
  if (!fs.existsSync(src)) return false;
  if (dryRun) return true;
  let content = fs.readFileSync(src, "utf8");
  content = content
    .replace(/^status:\s*active\s*$/m, `status: orphaned\norphaned_at: ${today}`)
    .replace(/^(status:\s*orphaned)$/m, `$1\norphaned_at: ${today}`);
  const dest = path.join(vaultRoot, ARCHIVE_DIR, path.basename(relPath));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, "utf8");
  fs.rmSync(src);
  return true;
}

/** Archive any previously-generated note whose path is no longer produced. */
export function reconcileOrphans(
  vaultRoot: string,
  prev: ManifestEntry[],
  currentPaths: Set<string>,
  today: string,
  dryRun: boolean,
): string[] {
  const archived: string[] = [];
  for (const entry of prev) {
    if (!currentPaths.has(entry.path) && archiveNote(vaultRoot, entry.path, today, dryRun)) {
      archived.push(entry.path);
    }
  }
  return archived;
}
