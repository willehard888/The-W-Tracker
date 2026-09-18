import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WEB_EXIT, WEB_ROUTES, isPublicWebHost, webExitFor } from "@/lib/web-surface";

// There is no web version of the app. On the public site only the legal pages
// and password reset may render from the React bundle; everything else leaves
// for the static page — including a route reached by an in-browser back button,
// which never asks the server.
describe("webExitFor", () => {
  it("lets the three web pages render on the public site", () => {
    for (const p of ["/privacy", "/terms", "/reset-password", "/privacy/"]) {
      expect(webExitFor("www.whealthfactory.com", p, false), p).toBeNull();
    }
  });

  it("sends every app route on the public site to the static page", () => {
    for (const p of ["/", "/landing", "/auth", "/coach", "/u/someone", "/paywall", "/tribes/abc"]) {
      expect(webExitFor("www.whealthfactory.com", p, false), p).toBe(WEB_EXIT);
      expect(webExitFor("whealthfactory.com", p, false), p).toBe(WEB_EXIT);
    }
  });

  it("never locks the native app, local development or preview deployments", () => {
    expect(webExitFor("localhost", "/coach", true)).toBeNull();
    expect(webExitFor("localhost", "/landing", false)).toBeNull();
    expect(webExitFor("the-w-tracker-git-main.vercel.app", "/landing", false)).toBeNull();
    // A lookalike that merely contains the name is not our host.
    expect(isPublicWebHost("whealthfactory.com.evil.example")).toBe(false);
  });
});

describe("the server agrees with the client", () => {
  const vercel = JSON.parse(readFileSync(resolve(__dirname, "../../../vercel.json"), "utf8")) as {
    redirects?: { source: string; destination: string }[];
    rewrites: { source: string; destination: string; has?: unknown }[];
  };

  it("serves the React shell only for the web pages, and the static site for everything else", () => {
    const toShell = vercel.rewrites.filter((r) => r.destination === "/app.html").map((r) => r.source).sort();
    expect(toShell).toEqual([...WEB_ROUTES].sort());
    const catchAll = vercel.rewrites.find((r) => r.source === "/(.*)");
    expect(catchAll?.destination).toBe("/index.html");
  });

  it("builds the site into the root and moves the shell aside, on Vercel only", () => {
    expect((vercel as unknown as { buildCommand: string }).buildCommand).toContain("node scripts/build-site.mjs");
  });

  it("serves the site at the root with no redirect, and retires /waitlist onto it", () => {
    expect((vercel.redirects ?? []).some((r) => r.source === "/")).toBe(false);
    expect((vercel.redirects ?? []).find((r) => r.source === "/waitlist")?.destination).toBe(WEB_EXIT);
    expect(WEB_EXIT).toBe("/");
  });
});
