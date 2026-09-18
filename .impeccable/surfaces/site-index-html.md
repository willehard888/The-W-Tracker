---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: ["public/support.html"]
---

# Surface brief: whealthfactory.com

Scope: the public website — one landing page plus company information. Static, no web app.
Visitor mode: Persuade.
Audience: ambitious 18–35 first, open to anyone after a steadier daily rhythm. English only.
Action: "Coming to the App Store" (no email capture); becomes an App Store link on launch day.
Proof: the real mechanism (daily check-in, earned status, coach, training, fuel, Vault, squad) and the real company. No testimonials, counts or outcomes.
Must also serve: Apple's organization-website check — the company's legal name, business ID and address, visibly.

## Direction contract

THESIS: The app's own world at page scale: the LOCK IN control is the product, so the page is the control, playable. Refuses a separate marketing look (round 1's luxury page was rejected for not matching the app).

OWN-WORLD: The app's tokens: plum-black ground hsl(258 20% 1.8%), gold hsl(42 78% 54%), ember hsl(18 95% 58%), Space Grotesk 700 uppercase headlines, Inter body, lucide icons, the app's card and grouped-list surfaces, the official app icon.

STORY: Join the movement; lock in your day in under a minute; the streak grows; every tier is earned; everything hangs off one check-in; 14 days free; coming to the App Store. Copy hooks without claiming outcomes (PRODUCT.md capabilities only).

FIRST VIEWPORT: JOIN THE MOVEMENT. over a hero-scale LOCK IN built from the app's CSS recipe (three hot plates, drips, sparks); press and hold melts it to LOCKED IN; subline, +160 XP · STREAK DAY 1, and an example day of three cards at the fold.

FORM: Founder-pinned round 2, comp r2-comp-3-lockin (seed 69a4fe1b carried).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Design system

`site/DESIGN.md` (website only; the app keeps its own system in `src/index.css`). Not served: build-site.mjs skips `.md`.

## Approved comp

`.impeccable/mocks/r2-comp-3-lockin.png` ("The Lock In"), round 2, picked by the founder in chat 2026-09-18. Round 1 (`comp-1-object.png`, the black-and-gold luxury page) shipped and was rejected: "webbi landing on huono ja typografia ei täsmää", "tee apin mukainen ja oikeasti miljardi luokan animaation", and on copy: "teksti myös huono never buy. sen pitää oikeasti olla koukuttava".

## Unresolved

- /privacy and /terms render from the app bundle in the app's own style, not this site's.
- The App Store link replaces the action on launch day.
