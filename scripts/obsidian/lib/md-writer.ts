// Markdown writer: renders frontmatter + a @generated region, hashes the body,
// and enforces idempotency + the "never clobber human notes" guard.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { GeneratedNote, WriteAction } from "../types.ts";

const OPEN = (source: string, id?: string) =>
  `<!-- @generated:obsidian-sync v1 source=${source}${id ? `#${id}` : ""} — DO NOT EDIT (edit the source in the repo, then re-run npm run obsidian:sync) -->`;
const CLOSE = `<!-- /@generated:obsidian-sync -->`;

export const bodyHash = (body: string): string =>
  "sha1:" + crypto.createHash("sha1").update(body, "utf8").digest("hex");

function serializeFrontmatter(fm: Record<string, unknown>): string {
  const lines: string[] = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map((x) => `${x}`).join(", ")}]`);
    } else if (typeof v === "number" || typeof v === "boolean") {
      lines.push(`${k}: ${v}`);
    } else {
      const s = String(v);
      // Quote if it contains YAML-significant chars.
      lines.push(/[:#"']/.test(s) ? `${k}: "${s.replace(/"/g, '\\"')}"` : `${k}: ${s}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

/** Read `generated:` + `hash:` from an existing file's frontmatter (no full YAML parse). */
function readMarkers(content: string): { generated: boolean; hash: string | null } {
  const fmEnd = content.indexOf("\n---", 3);
  const fm = content.startsWith("---") && fmEnd > 0 ? content.slice(0, fmEnd) : "";
  return {
    generated: /^generated:\s*true\s*$/m.test(fm),
    hash: fm.match(/^hash:\s*"?(sha1:[0-9a-f]+)"?/m)?.[1] ?? null,
  };
}

export interface WriteResult { action: WriteAction; path: string; }

/**
 * Write a generated note, idempotently.
 *  - skip   : on-disk body hash unchanged → leave file (stable mtime)
 *  - refuse : file exists but is NOT ours (no `generated: true`) → never clobber
 *  - create / update otherwise
 */
export function writeNote(
  vaultRoot: string,
  note: GeneratedNote,
  today: string,
  dryRun: boolean,
): WriteResult {
  const abs = path.join(vaultRoot, note.path);
  const hash = bodyHash(note.body);
  let action: WriteAction = "create";

  if (fs.existsSync(abs)) {
    const existing = fs.readFileSync(abs, "utf8");
    const { generated, hash: prevHash } = readMarkers(existing);
    if (!generated) return { action: "refuse", path: note.path };
    if (prevHash === hash) return { action: "skip", path: note.path };
    action = "update";
  }

  if (!dryRun) {
    const fm = serializeFrontmatter({
      ...note.frontmatter,
      generated: true,
      sync_version: 1,
      source: note.source,
      ...(note.sourceId ? { source_id: note.sourceId } : {}),
      hash,
      generated_at: today,
      status: "active",
    });
    const content = `${fm}\n\n${OPEN(note.source, note.sourceId)}\n\n${note.body.trim()}\n\n${CLOSE}\n`;
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
  return { action, path: note.path };
}
