import { describe, expect, it } from "vitest";
import { countCasts, stripCommentsAndStrings } from "../../../scripts/lib/cast-scan.mjs";

describe("cast-scan", () => {
  it("counts real casts", () => {
    expect(countCasts("const a = x as any; const b = y as  never;")).toEqual({ asAny: 1, asNever: 1 });
    expect(countCasts("f(x as any as never)")).toEqual({ asAny: 1, asNever: 1 });
  });
  it("ignores the words inside comments and strings", () => {
    const src = `// treated as any here\n/* it was never\n   used as never */\nconst s = "as any"; const t = 'as never'; const u = \`as any\`;\nreturn v;`;
    expect(countCasts(src)).toEqual({ asAny: 0, asNever: 0 });
  });
  it("is word-bounded", () => {
    expect(countCasts("const x = y as anything; z as neverland; has never")).toEqual({ asAny: 0, asNever: 0 });
  });
  it("keeps positions when blanking", () => {
    const src = 'a "b" // c';
    expect(stripCommentsAndStrings(src)).toHaveLength(src.length);
  });
});
