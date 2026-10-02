import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every coach voice hands the app ready questions, and every one of them is
 * bounded: the brief's array used to be unbounded (the client sliced three)
 * and a 200-character question is not a tap target. Read as text — the
 * functions import Deno modules.
 */
const FN = join(__dirname, "../../../supabase/functions");
const src = (f: string) => readFileSync(join(FN, f), "utf8");

describe("ready questions — bounded in every coach schema", () => {
  it("brief: exactly 3, ≤ 72 chars", () => {
    expect(src("coach-daily-brief/index.ts")).toMatch(/suggested_questions:\s*\{\s*type:\s*"array",\s*minItems:\s*3,\s*maxItems:\s*3,\s*items:\s*\{\s*type:\s*"string",\s*maxLength:\s*72/);
  });
  it("weekly review: exactly 3, ≤ 72 chars, required, stored through the RPC", () => {
    const s = src("coach-weekly-review/index.ts");
    expect(s).toMatch(/suggested_questions:\s*\{\s*type:\s*"array",\s*minItems:\s*3,\s*maxItems:\s*3,\s*items:\s*\{\s*type:\s*"string",\s*maxLength:\s*72/);
    expect(s).toMatch(/required:\s*\[[^\]]*"suggested_questions"/);
    expect(s).toContain("_suggested_questions: suggested_questions");
  });
  it("check-in reaction: exactly 2, ≤ 72 chars, returned with the line", () => {
    const s = src("coach-reaction/index.ts");
    expect(s).toMatch(/questions:\s*\{\s*type:\s*"array",\s*minItems:\s*2,\s*maxItems:\s*2,\s*items:\s*\{\s*type:\s*"string",\s*maxLength:\s*72/);
    expect(s).toMatch(/json\(\{\s*text:[^}]*questions\s*\}\)/);
  });
  it("chat: the follow-up trailer rule is in the full prompt, stripped from stored turns, and the cap is 60", () => {
    const s = src("ai-coach/index.ts");
    expect(s).toContain("@@FOLLOWUPS");
    expect(s).toMatch(/\$\{FOLLOWUPS_RULE\}/);
    expect(s).toContain('split("\\n@@FOLLOWUPS")[0].slice(0, 1500)');
    expect(s).toContain("messages.slice(-8)");
    expect(s).toContain("isPaid ? 60 : 40");
  });
});
