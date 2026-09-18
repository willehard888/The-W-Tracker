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

  it("serves the React bundle only for the web pages, and the static page for everything else", () => {
    const toBundle = vercel.rewrites.filter((r) => r.destination === "/index.html").map((r) => r.source).sort();
    expect(toBundle).toEqual([...WEB_ROUTES].sort());
    const catchAll = vercel.rewrites.find((r) => r.source === "/(.*)");
    expect(catchAll?.destination).toBe("/waitlist.html");
  });

  it("sends the root of both hosts to the static page", () => {
    const roots = (vercel.redirects ?? []).filter((r) => r.source === "/");
    expect(roots.length).toBe(2);
    for (const r of roots) expect(r.destination).toBe(WEB_EXIT);
  });
});
