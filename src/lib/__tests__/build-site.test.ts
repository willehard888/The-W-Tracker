import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error -- a plain .mjs build script, no type declarations
import { buildSite } from "../../../scripts/build-site.mjs";

// The site owns the root on Vercel; the React shell survives as app.html for
// the three web pages. Run twice, it would bury the site, so it refuses.
describe("buildSite", () => {
  const fixture = () => {
    const root = mkdtempSync(join(tmpdir(), "build-site-"));
    mkdirSync(join(root, "dist/assets"), { recursive: true });
    mkdirSync(join(root, "site/fonts"), { recursive: true });
    writeFileSync(join(root, "dist/index.html"), "spa");
    writeFileSync(join(root, "dist/assets/app.js"), "js");
    writeFileSync(join(root, "site/index.html"), "site");
    writeFileSync(join(root, "site/fonts/a.woff2"), "font");
    writeFileSync(join(root, "site/DESIGN.md"), "notes");
    mkdirSync(join(root, "site/.tool-state"), { recursive: true });
    writeFileSync(join(root, "site/.tool-state/x.json"), "{}");
    return root;
  };

  it("moves the shell to app.html and puts the site at the root", () => {
    const root = fixture();
    buildSite(root);
    expect(readFileSync(join(root, "dist/app.html"), "utf8")).toBe("spa");
    expect(readFileSync(join(root, "dist/index.html"), "utf8")).toBe("site");
    expect(readFileSync(join(root, "dist/fonts/a.woff2"), "utf8")).toBe("font");
    expect(readFileSync(join(root, "dist/assets/app.js"), "utf8")).toBe("js");
    expect(existsSync(join(root, "dist/DESIGN.md"))).toBe(false);
    expect(existsSync(join(root, "dist/.tool-state"))).toBe(false);
  });

  it("refuses a second run", () => {
    const root = fixture();
    buildSite(root);
    expect(() => buildSite(root)).toThrow(/already ran/);
  });
});
