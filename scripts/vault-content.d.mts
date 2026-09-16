/** Types for scripts/vault-content.mjs (the Vault library builder and lint), used by the tests. */

export interface VaultQuizItem {
  q: string;
  choices: string[];
  correct: number;
  explain: string;
}

export interface VaultReference {
  author: string;
  title: string;
  year?: number;
  url?: string;
}

export interface VaultPiece {
  category_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  evidence_tier: "strong" | "promising" | "speculative";
  read_time_min: number;
  protocol: Record<string, string>;
  benefits: string[];
  risks: string[];
  body_md: string;
  references_json: VaultReference[];
  display_order: number;
  lesson_number: number | null;
  course_role: "foundations" | "protocol" | "recap";
  why_it_matters: string | null;
  try_today: string[];
  key_takeaways: string[];
  quiz: VaultQuizItem[];
  master_slug: string | null;
  reflect_prompt: string | null;
  integrate_prompt: string | null;
  practice_minutes: number | null;
}

export interface LintFinding {
  slug: string;
  field: string;
  rule: string;
  sample: string;
}

export const BASE_PATH: string;
export const MIGRATIONS_DIR: string;
export const REWRITE_FROM: string;
export const REWRITTEN_CATEGORIES: string[];
export const ACRONYMS: Set<string>;
export const BANNED_PHRASES: string[];
export const PRODUCT_NAMES: string[];
export const AMERICAN: string[];
export const REGISTRY: { name: string; re: RegExp; want: string; only?: RegExp }[];
export const TEXT_FIELDS: string[];
export const ARRAY_FIELDS: string[];

export function loadBase(): VaultPiece[];
export function rewriteMigrationFiles(): string[];
export function parseStatements(sql: string): string[];
export function applyMigrationSql(pieces: VaultPiece[], sql: string, file?: string): VaultPiece[];
export function buildEffectiveLibrary(): VaultPiece[];
export function lintPiece(piece: VaultPiece): LintFinding[];
export function lintLibrary(pieces: VaultPiece[]): LintFinding[];
export function summarize(findings: LintFinding[]): [string, number][];
