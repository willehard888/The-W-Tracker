// Config for the Obsidian sync generator: vault-path resolution, folder names,
// theme grouping, source classifiers. No I/O here.
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** scripts/obsidian → ../.. = repo root (robust regardless of cwd). */
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const DEFAULT_VAULT = "/Users/rasmuspetterson/FounderOS-Vault";

/** Resolution order: --vault=… flag › VAULT_PATH env › default. */
export function resolveVaultPath(argv: string[], env: NodeJS.ProcessEnv): string {
  const flag = argv.find((a) => a.startsWith("--vault="));
  if (flag) return path.resolve(flag.slice("--vault=".length));
  if (env.VAULT_PATH) return path.resolve(env.VAULT_PATH);
  return DEFAULT_VAULT;
}

export const AUTO_DIR = "Auto";
export const ARCHIVE_DIR = "Auto/_Archive";
export const MANIFEST_PATH = "Auto/.sync-manifest.json";

// ── Migration classification ────────────────────────────────────────────────
// Opaque = timestamp + a UUID (Lovable-era, no encoded meaning). Semantic ones
// (timestamp + human slug) are the ADR-worthy decisions.
const OPAQUE_MIGRATION =
  /^\d{14}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.sql$/;
export const isSemanticMigration = (file: string): boolean =>
  file.endsWith(".sql") && !OPAQUE_MIGRATION.test(file);
export const isOpaqueMigration = (file: string): boolean =>
  OPAQUE_MIGRATION.test(file);

export interface ParsedMigration {
  file: string;
  ts: string;   // 14-digit
  date: string; // YYYY-MM-DD
  slug: string; // earned_status_phase1
  title: string;
}
export function parseMigration(file: string): ParsedMigration | null {
  const m = file.match(/^(\d{14})_(.+)\.sql$/);
  if (!m) return null;
  const [, ts, slug] = m;
  const date = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
  const title = slug.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { file, ts, date, slug, title };
}

// ── Edge-function → theme ───────────────────────────────────────────────────
export type CapabilityTheme =
  | "coach" | "growth" | "billing" | "reliability" | "social" | "content" | "auth" | "other";

export function capabilityTheme(fn: string): CapabilityTheme {
  if (/^coach|coach$|life-os|weekly-briefing|^ai-coach/.test(fn)) return "coach";
  if (/subscription|checkout|portal|revenuecat|stripe/.test(fn)) return "billing";
  if (/referral|winback|reminder|discovery|notify-message/.test(fn)) return "growth";
  if (/sync-streaks|resolve-battles/.test(fn)) return "reliability";
  if (/moderate|og-|push-test/.test(fn)) return "content";
  if (/delete-account|demo-login|auth/.test(fn)) return "auth";
  if (/battle|tribe|friend|message/.test(fn)) return "social";
  return "other";
}

export const THEME_LABEL: Record<CapabilityTheme, string> = {
  coach: "AI Coach", growth: "Growth & retention", billing: "Billing",
  reliability: "Reliability / cron", social: "Social", content: "Content & media",
  auth: "Auth & account", other: "Other",
};

// ── Changelog theme (git subject → group) ───────────────────────────────────
export function changelogTheme(subject: string): string {
  const s = subject.toLowerCase();
  if (/ios|portal|overlay|native|haptic|healthkit|health\b/.test(s)) return "iOS & native";
  if (/growth|viral|referral|win-back|winback|funnel|push|tz|analytics/.test(s)) return "Growth & viral";
  if (/reliab|streak|cron|auth|R\d|fix\b|bug/.test(s)) return "Reliability & fixes";
  if (/check-?in|habit/.test(s)) return "Check-in";
  if (/status|tier|elite|ladder|division|shield/.test(s)) return "Status ladder";
  if (/coach|causal|recovery/.test(s)) return "Coach & causal health";
  return "Other";
}

/** A citation is weak if it names no year AND no DOI/identifier. */
export const citationNeedsSource = (c: string): boolean =>
  !/(19|20)\d{2}/.test(c) && !/doi|http|isbn/i.test(c);
