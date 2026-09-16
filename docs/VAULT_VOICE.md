# The Vault voice

One voice for every piece in the library. The rules below are enforced by
`src/data/__tests__/vault-voice.test.ts` and `npm run vault:lint`; the
judgement calls are here so a new piece sounds like the shelf it joins.

## Who is talking

A careful editor who has read the source and run the practice, writing to one
member in the second person. Plain English. Short declarative sentences. One
idea per paragraph. A named person or a named study in the first two
sentences so authority is earned, not asserted. The piece states what it is
not claiming inside the prose, not in a box.

## What a piece is

- `title`: Title Case, "and" never "&". A master piece is "Name: The Idea".
- `subtitle`: one line that says what the reader gets, not a slogan.
- `summary`: opens with one short sentence (under 140 characters); Home uses
  it as a headline when the piece has no master. Then two or three sentences.
- `body_md`: 350 to 600 words for an idea, 250 to 450 for a protocol. Sections
  are `**Bold lines**` on their own line, followed by a single newline and
  the paragraph (no `##`, no tables, no code fences, no diagrams); the sheet
  keeps newlines inside a paragraph, so the heading sits on its own line.
  Bold only when a term is defined. Numbers carry units. Every "Name (year)"
  in the body has a row in `references_json`.
- `why_it_matters`: names the member's own data (check-in, streak, session,
  W-Index) and says what changes on a Tuesday.
- `benefits` (what it gives you) and `risks` (where it is honest about its
  limits): two to three each; every piece has at least one risk line.
- `try_today`: the practice. Two to three actions with a time or a count.
  Never "read another lesson".
- `key_takeaways`: three sentences that appear in the body.
- `quiz`: two or three questions, three choices, the correct index spread
  across 0, 1 and 2 across a shelf; `explain` says why in one sentence.
- `references_json`: at least two real works with author, title, year; a
  `Note` row states the relationship ("Original lesson on the ideas of X; not
  affiliated") wherever a named author's work is the subject.
- The loop: `reflect_prompt` (a question before the practice),
  `integrate_prompt` (a question after it), `practice_minutes` (5 to 20; 20
  means "over the week").
- `read_time_min` is `ceil(words / 200)` over body, try_today and takeaways.

## Typography

British spelling (behaviour, practise as the verb, visualisation, optimise).
`VO₂max`. `5%` with no space; `18 °C`, `30 g`, `2.5 kg` with a space. Ranges
with an en dash between digits only (`7–9 h`); no em dashes anywhere; a
sentence that wants one takes a period, a comma or a colon. No arrows, no
emoji, no ALL-CAPS emphasis (acronyms are fine: HRV, RPE, NSDR, MBSR, CBT,
XP, RCT, BAC, HR, PET, AD, BC). No placeholders in brackets. No product or
app recommendations.

## Words we do not use

game-changer, unlock, hack, biohack, protocol stack, "in today's", "here's
the thing", "it's important to note", delve, "the single biggest mistake",
"the entire secret", "IS the protocol", any invented round number ("90% of
the result follows"), any superlative the reference does not support ("the
most evidenced X on the planet").

## Evidence tiers

- **strong**: randomised trials or meta-analyses on the practice as written.
- **promising**: a plausible mechanism plus early or indirect trials, or
  cohort data (mortality cohorts are promising, not strong).
- **speculative**: the practice may work; the explanation offered for it is
  unsupported. Speculative is not an insult; keep the exercise, drop the story.

The chip rates the practice, never the worldview.

## One number, one owner

A dose lives in one piece (the owner) with its evidence paragraph. Every other
mention states the number the same way and names the owner: "the dose lives
in Morning Light Anchor". The registry is in the plan file for the 2026-09
rewrite and in `scripts/vault-content.mjs` (`REGISTRY`), which the lint
checks.

## Duplicates

A topic has one primary piece per shelf. A second piece on the same topic
must do a different job (the thinker's idea versus the protocol's dose;
informal practice versus a timed session) and say so in one cross-reference
sentence. A piece whose whole job is to restate another is retired.
