// git log → Dev Log, grouped by theme. Local run only (needs full history).
import { execFileSync } from "node:child_process";
import { REPO_ROOT, changelogTheme } from "../config.ts";
import type { GeneratedNote } from "../types.ts";
import { paths, wikilink } from "../lib/links.ts";

const SRC = "git";

interface Commit { sha: string; date: string; subject: string; }

export function generate(): GeneratedNote[] {
  let raw = "";
  try {
    raw = execFileSync(
      "git",
      ["-C", REPO_ROOT, "log", "--pretty=%h\t%ad\t%s", "--date=short", "-100"],
      { encoding: "utf8" },
    );
  } catch {
    return []; // no git / shallow clone → skip cleanly
  }

  const commits: Commit[] = raw.trim().split("\n").filter(Boolean).map((l) => {
    const [sha, date, ...rest] = l.split("\t");
    return { sha, date, subject: rest.join("\t") };
  });
  if (!commits.length) return [];

  const byTheme = new Map<string, Commit[]>();
  for (const c of commits) {
    const t = changelogTheme(c.subject);
    byTheme.set(t, [...(byTheme.get(t) ?? []), c]);
  }

  const head = commits[0].sha;
  const body = [
    `# Dev Log`, "",
    `Viimeiset ${commits.length} committia (HEAD \`${head}\`), ryhmiteltynä teemoittain.`, "",
  ];
  for (const [theme, list] of [...byTheme.entries()].sort((a, b) => b[1].length - a[1].length)) {
    body.push(`## ${theme} (${list.length})`);
    body.push(...list.map((c) => `- \`${c.date}\` ${c.subject} · \`${c.sha}\``));
    body.push("");
  }
  body.push(`## Linkit`, `- ${wikilink(paths.capabilityMap(), "Capability Map")}`, `- ${wikilink(paths.adrLedger(), "ADR Ledger")}`);

  return [{
    path: paths.devLog(),
    frontmatter: { title: "Dev Log", type: "changelog", source: "git", commit_count: commits.length, head_sha: head, tags: ["engineering", "changelog"] },
    body: body.join("\n"), source: SRC, sourceId: "dev-log",
  }];
}
