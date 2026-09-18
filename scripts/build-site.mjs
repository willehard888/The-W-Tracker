#!/usr/bin/env node
// Vercel only (vercel.json buildCommand). The public site is static: after
// `vite build`, the React shell moves to app.html, which serves only /privacy,
// /terms and /reset-password, and site/ becomes the root. The iOS build never
// runs this, so the app bundle keeps its index.html and never ships the site.
import { cpSync, existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function buildSite(root = process.cwd()) {
  const dist = resolve(root, "dist");
  if (!existsSync(resolve(dist, "index.html"))) throw new Error("build-site: dist/index.html missing, run vite build first");
  // A second run would move the site itself into app.html.
  if (existsSync(resolve(dist, "app.html"))) throw new Error("build-site: dist/app.html exists, already ran");
  renameSync(resolve(dist, "index.html"), resolve(dist, "app.html"));
  // DESIGN.md and other notes stay out of the public build.
  cpSync(resolve(root, "site"), dist, { recursive: true, filter: (src) => !src.endsWith(".md") });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildSite();
