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

THESIS: A manufacture of discipline — the daily ritual assembled by hand like a fine movement. Refuses the fitness launch page: floating phone, neon, feature cards.

OWN-WORLD: Black as the room; one gold, the W, as the only metal; gold hairline engraving; huge engraved serif capitals (Cormorant Garamond 300, the founder's pick over the comp's hairline sans, 2026-09-18); small tracked Archivo labels in warm white. No cards, no decorative gradients, no grain.

STORY: A house that makes discipline. The ritual ticks once a day; status here is earned, never bought; the app arrives on the App Store.

FIRST VIEWPORT: Pure black. Polished gold W at hero scale on a mirror floor, a slow light sweep across its face. Below it, over the reflection, JOIN THE MOVEMENT. in huge engraved capitals (the founder replaced "Discipline, made daily." on 2026-09-18). A gold hairline and COMING TO THE APP STORE at the foot. MANUFACTURE · ESPOO, FINLAND top right. Signature: a scroll-pinned gold dial whose hand sweeps the day, one ritual per hour mark; slow ease-out, transform and opacity only.

FORM: User-pinned luxury manufacture, after two bolder re-rolls; seed 69a4fe1b.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Design system

`site/DESIGN.md` (website only; the app keeps its own system in `src/index.css`). Not served: build-site.mjs skips `.md`.

## Approved comp

`.impeccable/mocks/comp-1-object.png` (The Object), confirmed by the founder in chat 2026-09-18.

## Unresolved

- /privacy and /terms render from the app bundle in the app's own style, not this site's.
- The App Store link replaces the action on launch day.
