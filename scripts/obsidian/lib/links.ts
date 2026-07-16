// Single source of truth for note filenames + wikilinks, so a link and its
// target can never drift. Every generator builds paths through here.

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Filesystem-safe kebab slug (strips emoji, diacritics, punctuation). */
export function slug(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(COMBINING_MARKS, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "note"
  );
}

/** Basename (no extension) of a vault-relative note path — the Obsidian link target. */
export const noteName = (relPath: string): string =>
  relPath.replace(/^.*\//, "").replace(/\.md$/, "");

/** `[[Name]]` or `[[Name|Alias]]` from a vault-relative path. */
export function wikilink(relPath: string, alias?: string): string {
  const name = noteName(relPath);
  return alias && alias !== name ? `[[${name}|${alias}]]` : `[[${name}]]`;
}

// ── Canonical note paths (vault-relative) ───────────────────────────────────
export const paths = {
  protocol: (pillar: string, title: string) =>
    `Auto/Wellness/Protocols/${pillar}/${slug(title)}.md`,
  pillar: (name: string) => `Auto/Wellness/Pillars/Pillar - ${name}.md`,
  frameworkIndex: () => `Auto/Wellness/Wellness Framework.md`,
  checkin: () => `Auto/Product/Daily Check-in.md`,
  statusTiers: () => `Auto/Product/Status Tiers.md`,
  adrLedger: () => `Auto/System/ADR Ledger.md`,
  capability: (fn: string) => `Auto/System/Capabilities/Capability - ${fn}.md`,
  capabilityMap: () => `Auto/System/Capability Map.md`,
  devLog: () => `Auto/System/Dev Log.md`,
};
