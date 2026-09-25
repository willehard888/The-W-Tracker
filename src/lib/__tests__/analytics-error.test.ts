import { describe, it, expect } from "vitest";
import { classifyError } from "../analytics-error";

describe("what an error may tell analytics", () => {
  it("names an error the app raised itself", () => {
    expect(classifyError(new Error("ALREADY_CHECKED_IN_TODAY")).reason).toBe("ALREADY_CHECKED_IN_TODAY");
    expect(classifyError({ message: "PREMIUM_REQUIRED" }).reason).toBe("PREMIUM_REQUIRED");
    // PostgREST wraps the RAISE in its own sentence; the token still has to land.
    expect(classifyError({ message: 'P0001: MEMBERSHIP_REQUIRED' }).reason).toBe("MEMBERSHIP_REQUIRED");
  });

  it("buckets what the app did not raise", () => {
    expect(classifyError(new Error("Load failed")).reason).toBe("network");
    expect(classifyError(new Error("new row violates row-level security policy")).reason).toBe("rls");
    expect(classifyError({ message: "duplicate key value violates unique constraint" }).reason).toBe("duplicate");
  });

  // The whole point of the module: the failure mode it replaces was a 120-char
  // slice of whatever Postgres said, which is a length cap and not a filter.
  it("never passes an unrecognised message through, at any length", () => {
    const rowLeak = `null value in column "email" of relation "profiles" violates not-null constraint, row was (matti.meikalainen@example.fi, 84.3, 6.5)`;
    const out = classifyError({ message: rowLeak });
    expect(out.reason).toBe("other");
    expect(JSON.stringify(out)).not.toContain("example.fi");
    expect(JSON.stringify(out)).not.toContain("84.3");
  });

  it("returns only two keys, whatever it is given", () => {
    for (const input of [null, undefined, "", 42, { message: 7 }, new Error("x"), { code: "23505" }]) {
      expect(Object.keys(classifyError(input)).sort()).toEqual(["code", "reason"]);
    }
  });

  it("keeps a code only when it is shaped like one", () => {
    expect(classifyError({ message: "x", code: "23505" }).code).toBe("23505");
    expect(classifyError({ message: "x", code: "PGRST301" }).code).toBe("PGRST301");
    // Not a code — a sentence in the code field is still a sentence.
    expect(classifyError({ message: "x", code: "could not find user matti@example.fi" }).code).toBeNull();
    expect(classifyError({ message: "x" }).code).toBeNull();
  });

  it("is total: no input throws", () => {
    for (const input of [null, undefined, 0, "", [], {}, Symbol("s"), () => {}]) {
      expect(() => classifyError(input)).not.toThrow();
    }
  });
});
