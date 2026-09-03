/**
 * Recipe poster generator.
 *
 * Emits one self-contained HTML page showing every recipe as a dark
 * Obsidian & Gold poster, for design review and export.
 *
 * Why generated rather than designed once and exported: the shipped posters
 * are cream JPEGs whose ingredient quantities and method steps are baked in as
 * pixels. They cannot be proof-read against `src/data/recipes.ts` and they
 * drift silently the moment either side is edited. Here every character comes
 * from RECIPES at build time, so the poster and the product cannot disagree —
 * and adding a recipe means re-running this, not opening a design tool.
 *
 * The photograph is the existing square crop, base64-inlined. It is already a
 * clean, text-free image, so nothing is regenerated and no model is asked to
 * spell "1/2 tsp garlic powder".
 *
 * Usage: npx vite-node scripts/recipe-posters.mts -- --out=<path.html>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RECIPES, type Recipe } from "@/data/recipes";
// Same formatter the recipe screen uses, so "0.5 tsp" prints as "1/2 tsp" on
// the poster exactly as it does in the app. Sharing it is the point: two
// formatters would be two ways to render the same quantity.
import { fmtQty } from "@/lib/recipe-scaling";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const outArg = process.argv.find((a) => a.startsWith("--out="));
const OUT = outArg ? outArg.slice("--out=".length) : resolve(ROOT, "recipe-posters.html");

/** Escape for HTML text nodes — recipe copy contains & and quotes. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const photoDataUri = (id: string): string | null => {
  try {
    const buf = readFileSync(resolve(ROOT, "src/assets/recipes/square", `${id}.jpg`));
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
};

const poster = (r: Recipe): string => {
  const photo = photoDataUri(r.id);
  const totalMin = r.prepMin + r.cookMin;

  const ingredients = r.groups
    .map(
      (g) => `
      <div class="grp">
        <p class="grp-t">${esc(g.title)}</p>
        <ul>
          ${g.items
            .map(
              (it) => `<li>${
                it.qty != null
                  ? `<b>${esc(fmtQty(it.qty, 1))}${it.unit ? ` ${esc(it.unit)}` : ""}</b> `
                  : ""
              }${esc(it.item)}${it.note ? `<span class="note"> (${esc(it.note)})</span>` : ""}</li>`,
            )
            .join("")}
        </ul>
      </div>`,
    )
    .join("");

  const method = r.method
    .map(
      (phase, i) => `
      <div class="step">
        <span class="num">${i + 1}</span>
        <div>
          <p class="step-t">${esc(phase.title)}</p>
          <ol>${phase.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
        </div>
      </div>`,
    )
    .join("");

  return `
  <section class="poster" id="${esc(r.id)}">
    <div class="glow"></div>
    <header>
      <div class="head-text">
        <p class="mark">Whealth Factory</p>
        <h2>${esc(r.title)}</h2>
        <div class="rule"></div>
        <p class="blurb">${esc(r.blurb)}</p>
        <div class="tags">${r.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
      </div>
      ${photo ? `<div class="photo"><img src="${photo}" alt=""></div>` : ""}
    </header>

    <!-- One hero stat, not six equal ones: protein is the promise this whole
         library is built on, so it carries the weight and the rest recede. -->
    <div class="stats">
      <div class="hero-stat">
        <p class="hero-n">${r.nutrition.protein}<span>g</span></p>
        <p class="hero-l">Protein</p>
      </div>
      <div class="minor">
        <div><b>${r.nutrition.calories}</b><span>kcal</span></div>
        <div><b>${r.nutrition.carbs}g</b><span>carbs</span></div>
        <div><b>${r.nutrition.fat}g</b><span>fat</span></div>
        <div><b>${totalMin}m</b><span>${r.prepMin}m prep · ${r.cookMin}m cook</span></div>
      </div>
    </div>

    <div class="body">
      <div class="col-ing">
        <p class="sec">Ingredients</p>
        ${ingredients}
      </div>
      <div class="col-met">
        <p class="sec">Method</p>
        ${method}
      </div>
    </div>

    <footer>
      <div><p class="f-l">Fridge</p><p class="f-v">${r.mealPrep.fridgeDays} days</p></div>
      ${
        r.mealPrep.freezerWeeks != null
          ? `<div><p class="f-l">Freezer</p><p class="f-v">${r.mealPrep.freezerWeeks} weeks</p></div>`
          : ""
      }
      <p class="reheat"><b>Reheat:</b> ${esc(r.mealPrep.reheat)}</p>
    </footer>
  </section>`;
};

const CSS = `
  :root {
    --ink: hsl(258 18% 5%);
    --ink-2: hsl(258 16% 8%);
    --gold: hsl(42 88% 60%);
    --gold-dim: hsl(42 55% 50%);
    --text: hsl(40 20% 96%);
    --muted: hsl(40 10% 72%);
    --faint: hsl(40 10% 52%);
    --line: hsl(42 40% 30% / 0.45);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: hsl(0 0% 7%);
    font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-feature-settings: "tnum";
    display: flex; flex-direction: column; align-items: center;
    gap: 48px; padding: 48px 16px;
  }
  .poster {
    position: relative; width: 1080px; height: 1620px; flex: none;
    background: var(--ink); color: var(--text); overflow: hidden;
    display: flex; flex-direction: column;
  }
  .glow {
    position: absolute; inset: auto 0 0 0; height: 640px; pointer-events: none;
    background: radial-gradient(ellipse 80% 100% at 50% 100%, hsl(28 80% 40% / 0.18), transparent 70%);
  }
  header { position: relative; display: flex; gap: 40px; padding: 60px 60px 0; }
  .head-text { flex: 1; min-width: 0; }
  .mark { font-size: 19px; font-weight: 900; letter-spacing: .34em; text-transform: uppercase; color: var(--gold); }
  h2 { font-size: 88px; font-weight: 900; line-height: .94; letter-spacing: -.02em; margin-top: 22px; text-wrap: balance; }
  .rule { width: 96px; height: 3px; border-radius: 999px; background: var(--gold); margin-top: 24px; }
  .blurb { font-size: 25px; line-height: 1.35; color: var(--muted); margin-top: 24px; }
  .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 26px; }
  .tags span {
    border: 1px solid hsl(42 40% 34% / .6); border-radius: 999px;
    padding: 7px 16px; font-size: 16px; font-weight: 900;
    letter-spacing: .12em; text-transform: uppercase; color: var(--gold-dim);
  }
  .photo {
    flex: none; width: 440px; height: 440px; border-radius: 28px; overflow: hidden;
    border: 1px solid hsl(42 50% 42% / .55);
    box-shadow: 0 30px 80px -30px hsl(28 90% 30% / .7);
  }
  .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .stats { position: relative; display: flex; align-items: stretch; gap: 28px; padding: 44px 60px 0; }
  .hero-stat {
    border: 1px solid var(--line); border-radius: 20px; background: var(--ink-2);
    padding: 20px 34px; display: flex; flex-direction: column; justify-content: center;
  }
  .hero-n { font-size: 76px; font-weight: 900; line-height: .9; color: var(--gold); }
  .hero-n span { font-size: 38px; }
  .hero-l { font-size: 16px; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; color: var(--faint); margin-top: 8px; }
  .minor { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); align-items: center; gap: 20px; }
  .minor div { display: flex; flex-direction: column; gap: 4px; }
  .minor b { font-size: 30px; font-weight: 900; color: var(--text); }
  .minor span { font-size: 15px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--faint); }

  .body { position: relative; display: flex; gap: 44px; padding: 46px 60px 0; flex: 1; min-height: 0; }
  .sec { font-size: 21px; font-weight: 900; letter-spacing: .26em; text-transform: uppercase; color: var(--gold); margin-bottom: 26px; }
  .col-ing { width: 400px; flex: none; }
  .col-met { flex: 1; min-width: 0; }
  .grp + .grp { margin-top: 22px; }
  .grp-t { font-size: 16px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; color: var(--faint); margin-bottom: 10px; }
  .col-ing ul { list-style: none; display: flex; flex-direction: column; gap: 7px; }
  .col-ing li { font-size: 21px; line-height: 1.3; color: hsl(40 14% 88%); }
  .col-ing b { color: var(--gold); font-weight: 900; }
  .note { color: var(--faint); }

  .step { display: flex; gap: 18px; }
  .step + .step { margin-top: 24px; }
  .num {
    flex: none; width: 46px; height: 46px; border-radius: 999px; background: var(--gold);
    color: var(--ink); font-size: 22px; font-weight: 900;
    display: flex; align-items: center; justify-content: center;
  }
  .step-t { font-size: 21px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }
  .step ol { list-style: none; display: flex; flex-direction: column; gap: 4px; }
  .step li { font-size: 20px; line-height: 1.35; color: var(--muted); }

  footer {
    position: relative; display: flex; align-items: center; gap: 44px;
    padding: 28px 60px; background: var(--ink-2); border-top: 1px solid var(--line);
  }
  .f-l { font-size: 14px; font-weight: 900; letter-spacing: .2em; text-transform: uppercase; color: var(--faint); }
  .f-v { font-size: 26px; font-weight: 900; color: var(--gold); line-height: 1.15; }
  .reheat { flex: 1; font-size: 19px; line-height: 1.35; color: var(--muted); }
  .reheat b { color: var(--text); font-weight: 900; }

  /* The poster is a fixed 1080px export canvas, so on anything narrower it is
     scaled as a whole rather than reflowed — reflowing would stop it being a
     preview of the exported image. */
  .scaler { transform-origin: top center; }
`;

// Emitted without doctype/html/head/body so the same file can be published as
// an Artifact (which supplies that skeleton) and still open locally.
const html = `<title>Recipe Posters</title>
<style>${CSS}</style>
${RECIPES.map((r) => `<div class="scaler">${poster(r)}</div>`).join("\n")}
<script>
  // Fit the 1080px canvas to the viewport, and reserve the scaled height so
  // the posters don't overlap once transformed.
  const fit = () => {
    const s = Math.min(1, (window.innerWidth - 24) / 1080);
    for (const el of document.querySelectorAll('.scaler')) {
      el.style.transform = 'scale(' + s + ')';
      el.style.height = (1620 * s) + 'px';
      el.style.width = '1080px';
    }
  };
  fit();
  window.addEventListener('resize', fit);
</script>`;

writeFileSync(OUT, html, "utf8");
console.log(`Wrote ${RECIPES.length} posters → ${OUT}`);
console.log(`${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
