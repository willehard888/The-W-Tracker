Make W Coach a real personal trainer by using the rich athlete profile the user already filled in, removing duplicated questions, and upgrading the AI to coach-grade prescriptions.

## 1. ProgramOnboarding → single "Coach briefing" screen
File: `src/components/coach/ProgramOnboarding.tsx` (rewrite)

- Drop the 4-step wizard. Pull goal / training days / session length / equipment / horizon / injuries from `useAthleteProfile` and show them as a read-only summary card with an "Edit" link to `/coach/profile`.
- Only ask for what is block-specific:
  - Body emphasis chips (optional): Chest/Back/Legs/Shoulders/Arms/Core/Glutes/Conditioning
  - "Anything new this block?" 200-char free text (travel, niggles, etc.)
- One CTA: "Design my block".
- Remove the duplicated goal/experience/days/equipment selection entirely.

## 2. `coach-generate-program` edge function — real personalization
File: `supabase/functions/coach-generate-program/index.ts`

Server pulls the full context (no longer trusts client to send goal/experience/etc.):
- `coach_athlete_profile` row (age, sex, height, weight, BF%, primary/secondary goal, horizon, sleep/wake, training_days_pref, preferred_session_length_min, equipment[], injuries[], dietary[], tone_pref, language_pref, i_am)
- 30d `daily_checkins` aggregates (workouts, avg sleep, hydration, protein adherence)
- 14d `coach_reflections` (avg RPE, energy, sleep_quality, mood; recurring frictions)
- Active `coach_goals`

Body inputs from client: `body_focus[]`, `block_notes` only.

Upgraded system prompt — senior S&C coach who:
- Schedules training onto exact `training_days_pref` weekdays, rest on the others
- Caps `duration_min ≤ preferred_session_length_min`
- Bans contraindicated movements per `injuries[]` and supplies a swap (`alt`)
- Writes `ai_summary` in the user's `tone_pref` voice, addressing their `i_am` line
- Uses bodyweight to suggest absolute load ranges where useful
- Decides week 4 = deload only if recent RPE > 8 avg or low sleep; otherwise consolidation
- Emits `progression_note` per week explaining the jump

Tool schema additions (all optional, backwards compatible):
- per block: `rest_sec`, `tempo`, `alt`
- per day: `warmup`, `cooldown`
- per week: `progression_note`
- top-level: `coach_signature`

## 3. Render the new richness
- `src/hooks/use-coach-program.ts` — extend `ProgramBlock`/`ProgramDay`/`ProgramWeek`/`PlanJson` with the new optional fields.
- `src/components/coach/TodaySessionCard.tsx` — show warm-up band above and cooldown band below the blocks; show `rest_sec` and `tempo` next to each block; show `b.alt` as a small "Swap" hint.
- `src/components/coach/ProgramWeekAccordion.tsx` — surface `progression_note` at the top of each week (additive).

## Technical details

- No DB schema change (plan_json is jsonb; `coach_programs.constraints` already stores block notes).
- Keep `tool_choice` forced and `model: openai/gpt-5`. Bump prompt only.
- Edge function ignores client-supplied goal/experience/days/equipment from now on, eliminating drift between profile and program.
- Renderer treats all new fields as optional → existing programs keep working.

## Out of scope
No payment, tab, or athlete-profile-onboarding changes. No new tables.