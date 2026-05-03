## Make Coach feel like a premium, in-house personal trainer (not a separate app)

Goal: When the user opens Coach it should feel like the same W app — same chrome, same flame/gold language as Home — but with a single, focused "trainer in your pocket" experience. Premium, knowledgeable, contextual, calm.

### Why it currently feels like a separate app
- Custom back-button header replaces the global app shell → looks like a different product.
- 3 generic tabs (Today / Plan / Progress) on top of an isolated card stack — no thread connecting them.
- Chat is a hidden FAB; the trainer's "voice" never surfaces unprompted.
- Trainer has no presence/identity — no name, no greeting, no read on today's state, no proactive note.
- Training session card, missions, reflections, habits, goals are 5 unrelated cards instead of one coherent daily brief from the trainer.

### What changes (UX)

1. **Native shell, not an island** (`src/pages/Coach.tsx`)
   - Drop the custom Header bar entirely. Use the standard app top spacing + `BottomNav` like Home.
   - Profile/Memory shortcuts move into a tiny in-page "trainer card" overflow (•••), not a sub-header.
   - Page background uses the same gradient/flame ambience as Home (subtle gold glow top, no boxed header).

2. **The Trainer becomes a person, not a tab system**
   - At the top: a **Trainer Brief** — large, calm, signed by "W Coach". One paragraph, written fresh each morning by the AI based on athlete profile + last 7d + today's session + sleep:
     > "Morning, Ville. Sleep was 6.4h — we'll keep volume but drop top set RPE to 7. Push lower body intent today; protein 180g; lights out by 23:30."
   - Generated server-side, cached per day per user, regenerated when checkin/sleep updates.
   - Below the brief: **today's session** as the hero, then a single compact "Daily focus" row (mission · reflection · habits as inline chips, not stacked cards).
   - Goal progress shown as a 1-line ribbon at the very top of the brief ("Week 3 of 8 · Strength · on track").

3. **One scroll, one conversation thread**
   - Replace the 3-tab pill with a **segmented inline jump**: `Today` (default), `This week`, `My plan`, `Progress` — but as in-page scroll anchors, not isolated views. The page is one continuous coach session, not 4 disconnected screens.
   - "This week" = condensed week strip (7 dots, today highlighted, tap for that day).
   - "My plan" = the program accordion inline.
   - "Progress" = compact stats inline.

4. **Chat as the trainer's voice, always reachable**
   - Replace the floating circular FAB with a **persistent "Ask Coach" composer pinned to the bottom** of the Coach page (above BottomNav, like an iMessage input). One line, always visible. Tapping focuses; submitting opens the conversation as a sheet that slides up over content (not a separate route).
   - Empty state shows 3 suggestions tailored to today's brief (e.g. "Why RPE 7 today?", "Swap squat — knee feels off", "Pre-bed routine").
   - Messages persist; the brief at top references the latest exchange ("We adjusted today's squat to front squat — see plan").

5. **Trainer identity & polish**
   - Small "W Coach" signature line under the brief with a subtle gold pulse dot when a new brief is ready.
   - Tone strictly per athlete profile (`tone_pref`) — Drill Sergeant / Calm Mentor / Scientist / Hype — already in profile, just wire it into the daily brief prompt.
   - Reference user by first name (from `i_am` / username) and reference 1-2 specific recent stats per brief — never generic.

### What changes (technical)

**New edge function: `coach-daily-brief`** (`supabase/functions/coach-daily-brief/index.ts`)
- JWT auth + `has_active_access` gate.
- Inputs: athlete profile, today's program day (week/day_index from active program), last 3 checkins, sleep, latest reflection, latest goal progress.
- Calls Lovable AI Gateway `openai/gpt-5` (non-streaming, ~120 tokens) with a tight system prompt that bakes in the user's `tone_pref`, language, and the prescription style rules.
- Tool-call output (structured): `{ ribbon, brief_md, prescriptions: [{label, value}], suggested_questions: string[3] }`.
- Stores in new table `coach_daily_briefs(user_id, brief_date, payload jsonb, created_at)` with RLS (user can read own; insert via SECURITY DEFINER RPC `upsert_daily_brief`).
- Triggered on Coach mount: client calls function; if a row exists for `today` returns cached, else generates.

**Migration**
- Create table `coach_daily_briefs` + RLS policies (`select` own, no direct insert).
- Create `upsert_daily_brief(_payload jsonb)` SECURITY DEFINER RPC.

**New components**
- `src/components/coach/TrainerBrief.tsx` — ribbon, signed brief, prescriptions row, "ask" suggestions. Loading shimmer.
- `src/components/coach/CoachComposer.tsx` — persistent bottom composer with sheet expansion (uses existing `framer-motion`).
- `src/components/coach/WeekStrip.tsx` — 7-day dot strip with focus per day.

**Refactor `src/pages/Coach.tsx`**
- Remove `Header`, tab pills, FAB, full-screen chat overlay.
- New layout (single scroll):
  ```text
  TrainerBrief                 ← daily AI brief, signed
  TodaySessionCard             ← unchanged content, lighter chrome
  WeekStrip                    ← horizontal week dots
  Daily focus row              ← Mission · Reflection · Habits inline
  ProgramWeekAccordion         ← inline, no tab
  PerformanceOSDashboard       ← inline, no tab
  CoachComposer (sticky)       ← always visible, opens chat sheet
  ```
- Keep BottomNav visible (don't hide it on /coach).

**Refactor `TodaySessionCard.tsx`**
- Drop the gold gradient panel; use a flat surface that matches Home cards (no separate-app vibe).
- Header line shows trainer's RPE/tempo decision tied to today's brief: "Today's call: RPE 7, full ROM, 3-1-1 tempo."

**Update `ai-coach` system prompt**
- Inject athlete `tone_pref`, `i_am`, `primary_goal`, target horizon, equipment, no-go protocols.
- Inject today's prescribed session (focus, blocks summary).
- Inject today's brief if exists, so chat is consistent with the brief.
- Reduce length cap; encourage 3-5 sentence answers + a single next action line.

**Update `BottomNav.tsx`**
- No change required; already shown on `/coach`. Just ensure Coach page padding leaves room for both the composer and BottomNav.

### Files to add
- `supabase/functions/coach-daily-brief/index.ts`
- `src/components/coach/TrainerBrief.tsx`
- `src/components/coach/CoachComposer.tsx`
- `src/components/coach/WeekStrip.tsx`
- New migration: `coach_daily_briefs` table + RLS + `upsert_daily_brief` RPC.

### Files to edit
- `src/pages/Coach.tsx` — strip tabs/header/FAB, single-scroll layout, mount TrainerBrief + composer.
- `src/components/coach/TodaySessionCard.tsx` — flatter chrome, integrate trainer's call line.
- `supabase/functions/ai-coach/index.ts` — richer system prompt (tone, today session, brief).
- `src/components/coach/ProgramWeekAccordion.tsx` — minor: render inline (no own header) when embedded.

### Out of scope
- No changes to program generation logic or athlete onboarding flow.
- No new payment gating (membership gate already covers it).

Approve and I'll ship this in one pass.