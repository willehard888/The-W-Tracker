---
name: launch
description: App Store launch readiness for The W Tracker — run this when the user says "julkaisu", "App Store", "launch", "review", "lähetetään appstoreen", or asks what's missing before shipping to the App Store. Audits the repo against Apple's App Review guidelines, privacy requirements, and store-listing needs, then reports pass/fail per item with the founder's ASC to-dos separated out. Use it BEFORE submitting any build for review — a rejection costs a week.
---

# Launch — App Store readiness audit

An App Review rejection costs days to weeks; most rejections come from a
short list of predictable causes. This skill turns that list into an audit:
verify every code-checkable item against the actual repo, mark the rest as
founder actions in App Store Connect, and report honestly.

## How to run the audit

1. Read `references/checklist.md` — the full item list with, for each item,
   WHERE in this repo to verify it (file paths, greps) and which Apple
   guideline it maps to.
2. Verify every code-checkable item by reading the code — never assume an
   item passes because it "should" exist. An item is ✓ only when you saw the
   evidence in this repo today.
3. Produce the report in three buckets:
   - **✓ Valmis** — verified in code, with the file reference.
   - **✗ Korjattava** — missing or broken in the repo; propose a targeted
     fix batch for each (founder approves before coding, per house rules).
   - **👤 Founderin tehtävä** — App Store Connect UI work Claude cannot do
     (metadata, screenshots upload, agreements, review notes). Give exact
     click-paths and ready-to-paste text where possible.
4. Publish the report as an artifact (dark gold house style, like the UI
   audit page) plus a terminal TLDR that leads with the blockers.
5. Anything fixed afterwards ships through the `release-qa` skill as usual.

## Judgment notes

- HealthKit, subscriptions, and user-generated content are this app's three
  highest-risk review areas — check those checklist sections first and most
  carefully.
- If an item cannot be verified from the repo (needs a device, ASC access,
  or Apple's questionnaire), say so — an unverifiable item is reported as
  open, never assumed green.
- Apple's rules change; when a checklist item smells outdated, verify
  against current App Review Guidelines via web search before flagging or
  clearing it, and update `references/checklist.md` in the same push.
