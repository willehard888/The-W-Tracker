#!/usr/bin/env node
/**
 * Type-debt ratchet.
 *
 * Measures two forms of type debt and fails if either GROWS past a committed
 * baseline (.type-debt-baseline.json):
 *   • strictErrors — errors under the shadow tsconfig.strict.json (strict +
 *     strictNullChecks + noImplicitAny). The real Vite build is unaffected.
 *   • asAny        — count of `as any` escape hatches in src/.
 *
 * This lets the team turn strictness on for NEW code immediately while paying
 * down existing debt file-by-file — no big-bang `strict: true` flip.
 *
 * Usage:
 *   node scripts/type-debt.mjs            # check (CI): non-zero exit if debt grew
 *   node scripts/type-debt.mjs --update   # record current counts as the new baseline
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASELINE_FILE = ".type-debt-baseline.json";

const countStrictErrors = () => {
  try {
    execSync("npx tsc -p tsconfig.strict.json --noEmit", { stdio: "pipe" });
    return 0;
  } catch (e) {
    const out = `${e.stdout?.toString() ?? ""}${e.stderr?.toString() ?? ""}`;
    return (out.match(/error TS\d+/g) ?? []).length;
  }
};

const countAsAny = () => {
  try {
    const out = execSync('grep -rn "as any" src --include="*.ts" --include="*.tsx"', {
      stdio: "pipe",
    }).toString();
    return out.split("\n").filter(Boolean).length;
  } catch (e) {
    if (e.status === 1) return 0; // grep: no matches
    throw e;
  }
};

const current = { strictErrors: countStrictErrors(), asAny: countAsAny() };

if (process.argv.includes("--update")) {
  writeFileSync(BASELINE_FILE, `${JSON.stringify(current, null, 2)}\n`);
  console.log("Baseline updated:", current);
  process.exit(0);
}

const baseline = existsSync(BASELINE_FILE)
  ? JSON.parse(readFileSync(BASELINE_FILE, "utf8"))
  : { strictErrors: Infinity, asAny: Infinity };

let failed = false;
for (const key of ["strictErrors", "asAny"]) {
  const cur = current[key];
  const base = baseline[key] ?? Infinity;
  const symbol = cur > base ? "✗" : cur < base ? "↓" : "✓";
  console.log(`${symbol} ${key}: ${cur} (baseline ${base})`);
  if (cur > base) failed = true;
}

if (failed) {
  console.error(
    "\nType debt increased. New code must be strict-clean and avoid `as any`.\n" +
      "If you legitimately REDUCED debt, refresh the baseline:\n" +
      "  node scripts/type-debt.mjs --update",
  );
  process.exit(1);
}
console.log("\nType debt held or fell. 👍");
