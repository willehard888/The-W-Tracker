// Shared types for the Obsidian sync generator.

export interface GeneratedNote {
  /** Path relative to the vault root, e.g. "Auto/Wellness/Protocols/sleep/sleep-7-9h.md". */
  path: string;
  /** Frontmatter key/values (title, type, tags…). The writer adds generated/hash/generated_at. */
  frontmatter: Record<string, unknown>;
  /** Markdown body (no frontmatter). Its sha1 drives skip-if-unchanged. */
  body: string;
  /** Source file/dir this note was generated from (for the @generated marker). */
  source: string;
  /** Stable id for orphan tracking (protocol id, migration slug…). Omit for singleton notes. */
  sourceId?: string;
}

export interface SyncContext {
  repoRoot: string;
  vaultRoot: string;
  dryRun: boolean;
}

export type WriteAction = "create" | "update" | "skip" | "refuse";

export interface ManifestEntry {
  path: string;
  source: string;
  sourceId?: string;
  hash: string;
}
