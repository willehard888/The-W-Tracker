## Make Coach clearer (tighter, less text)

Goal: less visual noise, fewer competing cards, fewer labels. Same info, faster to read on mobile.

### 1. Header & tabs (`src/pages/Coach.tsx`)
- Drop the gold orb + "W Coach / Premium" stack. Keep a single clean header: back button, title `Coach`, small gold dot for Premium.
- Collapse tabs from 5 → 3: `Today`, `Plan`, `Progress`.
  - Move `Habits` content under `Today` (small section below session) since it's read frequently with the daily flow.
  - Move `Chat` to a floating action button (bottom-right, gold) on every tab — opens chat as a sheet/route. Removes a permanent tab and matches "ask anytime" mental model.
- Tab pill: keep gold active style but reduce padding & remove uppercase tracking on inactive labels for less visual weight.

### 2. Today tab (`src/pages/Coach.tsx`)
Current order has 4 cards stacked (Goal, Mission, Reflection, Session) + 2 quick links. Tighten to one clear vertical flow:

```text
[ Today's session — hero card ]      ← primary, always first
[ Daily mission ]                    ← single line if completed
[ Evening reflection ]               ← only renders after 18:00 or if open
[ Habits strip ]                     ← compact horizontal chips
[ Goal progress ]                    ← single line summary, tap to expand
[ Profile · Memory ] (icon row)      ← shrunk to 2 small icon buttons in header area
```

Changes:
- Move Profile/Memory shortcuts out of Today into a header overflow (small icons next to back button) — frees one card slot.
- `GoalTrackerCard`, `EveningReflectionCard`: add a `compact` prop so they collapse to one line when not actionable, expand on tap.
- `DailyMissionCard`: when done, render as a single check-row instead of full card.

### 3. TodaySessionCard (`src/components/coach/TodaySessionCard.tsx`)
Reduce from 6 visual layers to 3 clear bands:
- **Header band**: `Week N · Day` (small) + big focus title + one meta line `45 min · 4 blocks`. Drop the duplicate icon row.
- **Blocks list**: cleaner row layout, no nested borders.
  - `Name` left, `4×8 @ RPE 8` right (gold).
  - Secondary line: `90s rest · 3-1-1-0` in muted micro-text only when present.
  - Notes/Swap collapsed under a small "More" chevron per block (most users skim).
- **Warmup/Cooldown**: convert to inline single-line accordion bands at top/bottom (label + first 60 chars, tap to expand). Removes the two boxed cards always visible.
- Remove the `Week theme` stat card at the bottom (Sleep/Protein/Mobility) — duplicates Plan tab. Keeps Today focused on "what do I do now".
- CTA button stays full-width gold.

### 4. Plan tab (`ProgramWeekAccordion.tsx`)
- Collapse `ai_summary` block into a 2-line clamped text with "Read more".
- Each week row: only show `Week N` + theme; drop the `· Current` chip and use a left gold bar instead.
- Inside open week: hide Nutrition/Recovery cards behind a small "Week details" toggle (most days users only want the day list).
- Day rows: remove the 9-char `S/M/T...` slot; show full short day (`Mon`) once. Keep block list as-is but lose extra paddings.

### 5. Microcopy pruning (across Coach)
- Drop redundant uppercase eyebrows where the title alone is enough (`Today · Week 1 · Mon` only on Today hero).
- Replace "Mark session done" → "Done".
- Replace "Logged for today" → "Done · today".
- Remove footer line "Educational guidance — not medical advice." from chat (move to a once-shown disclaimer in chat empty state).

### Files to edit
- `src/pages/Coach.tsx` — tabs, header, Today layout, FAB chat entry.
- `src/components/coach/TodaySessionCard.tsx` — band restructure, collapsible warmup/cooldown & block extras, drop week stats.
- `src/components/coach/ProgramWeekAccordion.tsx` — clamp summary, simplify week chrome, hide nutrition/recovery behind toggle.
- `src/components/coach/DailyMissionCard.tsx`, `GoalTrackerCard.tsx`, `EveningReflectionCard.tsx` — add `compact` collapsed states.
- `src/components/coach/HabitsTab.tsx` — extract a compact `HabitsStrip` for Today.

### Out of scope
- No backend/edge-function changes.
- No changes to program generation logic or data schema.

Approve and I'll ship in one pass.